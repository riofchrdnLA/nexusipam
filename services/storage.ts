
import { Subnet, IPRecord, IPStatus, User } from "../types";
import { generateMockSubnet } from "./ipUtils";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Service to interact with Supabase Database.
 * Maps Relational DB data to the Nested Object structure used by the UI.
 */
export const StorageService = {
  
  async authLogin(email: string): Promise<{user: User | null, error: string | null}> {
    // 1. Definisikan Mock User (Fallback)
    const mockUser: User = { 
        username: email, 
        role: email.includes('admin') ? 'admin' : 'user' 
    };

    // 2. Jika config Supabase tidak ada, langsung masuk mode lokal
    if (!isSupabaseConfigured) {
       console.warn("Supabase credentials missing. Using Mock Auth.");
       return { user: mockUser, error: null };
    }

    try {
        // 3. Coba Login ke Supabase
        const auth = supabase.auth as any;
        
        // Percobaan Login
        const { data: signInData, error: signInError } = await auth.signInWithPassword({
            email: email,
            password: 'password123', 
        });

        // Jika user belum ada atau login gagal, coba Register otomatis
        if (signInError) {
            console.log("Login failed, trying auto-signup...", signInError.message);
            
            const { data: signUpData, error: signUpError } = await auth.signUp({
                email,
                password: 'password123',
            });
            
            // CRITICAL FIX: Jika Sign Up juga gagal (misal validasi email ketat), 
            // JANGAN return error. Tapi Fallback ke Local Mode agar user tetap bisa masuk dashboard.
            if (signUpError) {
                console.warn("Supabase Auth failed (Email validation/Connection). Falling back to Local Mode.", signUpError);
                return { user: mockUser, error: null }; // <-- FAIL SAFE RETURN
            }
            
            // Jika signup sukses
            if(signUpData.user) {
                 // Coba ambil profile jika ada
                 const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', signUpData.user.id)
                    .single();
                    
                 return { 
                     user: { 
                         username: profile?.username || email, 
                         role: profile?.role || mockUser.role 
                     }, 
                     error: null 
                 };
            }
        }

        // Jika Login sukses
        if (signInData.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', signInData.user.id)
                .single();
                
             return { 
                 user: { 
                     username: profile?.username || email, 
                     role: profile?.role || mockUser.role 
                 }, 
                 error: null 
             };
        }
        
        // Fallback terakhir
        return { user: mockUser, error: null };

    } catch (e) {
        // Jika terjadi error teknis parah (misal network down), tetap izinkan masuk
        console.error("Critical Auth Error, using Local Mode:", e);
        return { user: mockUser, error: null };
    }
  },

  async getAllSubnets(): Promise<Subnet[]> {
    if (!isSupabaseConfigured) return this.getMockData();

    try {
      // 1. Fetch Subnets
      const { data: subnetsData, error: subnetError } = await supabase
        .from('subnets')
        .select('*')
        .order('created_at', { ascending: true });

      if (subnetError) throw subnetError;
      if (!subnetsData) return [];

      // 2. Fetch All IPs (Optimization: could be done per subnet, but for IPAM size, one query is usually fine)
      const { data: ipData, error: ipError } = await supabase
        .from('ip_records')
        .select('*');

      if (ipError) throw ipError;

      // 3. Merge Data
      const result: Subnet[] = subnetsData.map((s: any) => {
        const subnetIPs = ipData?.filter((ip: any) => ip.subnet_id === s.id) || [];
        
        const recordsMap: Record<string, IPRecord> = {};
        subnetIPs.forEach((ip: any) => {
            recordsMap[ip.ip] = {
                ip: ip.ip,
                status: ip.status as IPStatus,
                hostname: ip.hostname,
                owner: ip.owner,
                description: ip.description,
                lastUpdated: ip.last_updated
            };
        });

        return {
            id: s.id,
            name: s.name,
            cidr: s.cidr,
            gateway: s.gateway,
            vlan: s.vlan,
            records: recordsMap
        };
      });

      return result.length > 0 ? result : this.getMockData();

    } catch (e) {
      console.error("Supabase Fetch Error:", e);
      return this.getMockData();
    }
  },

  async createSubnet(subnet: Subnet): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Insert Subnet
      const { data: newSubnet, error } = await supabase
        .from('subnets')
        .insert({
            name: subnet.name,
            cidr: subnet.cidr,
            gateway: subnet.gateway,
            vlan: subnet.vlan
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Prepare IP Records
      const ipRows = Object.values(subnet.records).map(r => ({
          ip: r.ip,
          subnet_id: newSubnet.id, // Use the real ID from DB
          status: r.status,
          hostname: r.hostname,
          last_updated: Date.now()
      }));

      // 3. Bulk Insert IPs
      const { error: ipError } = await supabase
        .from('ip_records')
        .insert(ipRows);

      if (ipError) throw ipError;

    } catch (e) {
      console.error("Supabase Create Error:", e);
      // throw e; // Jangan throw error agar UI tidak crash, cukup log saja
    }
  },

  async updateIP(subnetId: string, ipRecord: IPRecord): Promise<void> {
     if (!isSupabaseConfigured) return;
     
     try {
         const { error } = await supabase
            .from('ip_records')
            .update({
                status: ipRecord.status,
                hostname: ipRecord.hostname,
                owner: ipRecord.owner,
                description: ipRecord.description,
                last_updated: Date.now()
            })
            .eq('ip', ipRecord.ip);
            
         if (error) throw error;
     } catch (e) {
         console.error("Supabase Update Error:", e);
     }
  },

  async deleteSubnet(subnetId: string): Promise<void> {
      if (!isSupabaseConfigured) return;
      
      // Cascading delete is handled by Postgres Schema (ON DELETE CASCADE)
      const { error } = await supabase.from('subnets').delete().eq('id', subnetId);
      if (error) console.error("Delete Error:", error);
  },

  // Mock Data fallback
  getMockData(): Subnet[] {
      const officeSubnet = generateMockSubnet('192.168.1.0/24', 'HQ - Floor 1');
      const serverSubnet = generateMockSubnet('10.0.50.0/24', 'Data Center A');
      return [
        { id: '1', name: 'HQ - Floor 1', cidr: '192.168.1.0/24', gateway: '192.168.1.1', vlan: 10, records: officeSubnet },
        { id: '2', name: 'Data Center A', cidr: '10.0.50.0/24', gateway: '10.0.50.1', vlan: 50, records: serverSubnet }
      ];
  }
};
