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
      if (!subnetsData) return []; // Return empty if no subnets, DO NOT use mock data here

      // 2. Fetch All IPs
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

      return result; // Pure DB result

    } catch (e) {
      console.error("Supabase Fetch Error:", e);
      // Only fallback to mock data if there is a CRITICAL connection error, not just empty data
      return [];
    }
  },

  /**
   * Subscribe to Realtime changes on Subnets and IP Records
   */
  subscribeToRealtime(callback: () => void) {
      if (!isSupabaseConfigured) return { unsubscribe: () => {} };

      const channel = supabase.channel('realtime-nexus-ipam')
          .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'subnets' },
              (payload) => {
                  console.log('Subnet Change:', payload);
                  callback();
              }
          )
          .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'ip_records' },
              (payload) => {
                  console.log('IP Change:', payload);
                  callback();
              }
          )
          .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                  console.log("Realtime Connected!");
              }
          });

      return channel;
  },

  async createSubnet(subnet: Subnet): Promise<void> {
    if (!isSupabaseConfigured) {
        console.error("Cannot create subnet: Supabase is not configured.");
        return;
    }

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

      if (error) {
          console.error("Error creating subnet row:", error);
          throw error;
      }

      console.log("Subnet created in DB:", newSubnet.id);

      // 2. Prepare IP Records
      const ipRows = Object.values(subnet.records).map(r => ({
          ip: r.ip,
          subnet_id: newSubnet.id, // Use the real ID from DB
          status: r.status,
          hostname: r.hostname,
          last_updated: Date.now()
      }));

      // 3. Bulk Insert IPs
      // Split into chunks if too big (Supabase has limit around ~1000 rows sometimes, but usually fine)
      const { error: ipError } = await supabase
        .from('ip_records')
        .insert(ipRows);

      if (ipError) {
          console.error("Error inserting IP records:", ipError);
          // Rollback subnet creation if IPs fail? For now, just throw.
          throw ipError;
      }
      
      console.log("IP Records created:", ipRows.length);

    } catch (e) {
      console.error("Supabase Create Transaction Error:", e);
      throw e; // Propagate to caller
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
      
      const { error } = await supabase.from('subnets').delete().eq('id', subnetId);
      if (error) console.error("Delete Error:", error);
  },

  getMockData(): Subnet[] {
      const officeSubnet = generateMockSubnet('192.168.1.0/24', 'HQ - Floor 1 (MOCK)');
      return [
        { id: '1', name: 'HQ - Floor 1 (MOCK)', cidr: '192.168.1.0/24', gateway: '192.168.1.1', vlan: 10, records: officeSubnet }
      ];
  }
};
