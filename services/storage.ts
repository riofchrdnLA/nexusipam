
import { Subnet, IPRecord, IPStatus, User } from "../types";
import { generateMockSubnet } from "./ipUtils";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

/**
 * Service to interact with Supabase Database.
 * Maps Relational DB data to the Nested Object structure used by the UI.
 */
export const StorageService = {
  
  async authLogin(email: string): Promise<{user: User | null, error: string | null}> {
    // For this demo simplified, we might just simulate login if Supabase isn't configured
    if (!isSupabaseConfigured) {
       console.warn("Supabase credentials missing. Using Mock Auth.");
       return { 
           user: { username: email, role: email.includes('admin') ? 'admin' : 'user' }, 
           error: null 
       };
    }

    // In a real app, you would use supabase.auth.signInWithPassword
    // For now, we just fetch the profile based on username (email) for this specific demo flow
    // Or we can implement a true auth flow. Let's keep it simple: 
    // If env is set, use real auth.
    
    try {
        // Cast to any to avoid type errors if types are mismatched in environment
        const auth = supabase.auth as any;
        const { data, error } = await auth.signInWithPassword({
            email: email,
            password: 'password123', // Hardcoded for demo simplicity, in real app pass password
        });

        if (error) {
            // If login fails, maybe user doesn't exist, let's try to sign up (auto-provision for demo)
            const { data: upData, error: upError } = await auth.signUp({
                email,
                password: 'password123',
            });
            
            if (upError) return { user: null, error: upError.message };
            
            // Fetch profile after signup
            if(upData.user) {
                 const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', upData.user.id)
                    .single();
                 return { user: { username: profile.username, role: profile.role }, error: null };
            }
        }

        if (data.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
             return { user: { username: profile?.username || email, role: profile?.role || 'user' }, error: null };
        }
        
        return { user: null, error: "Login failed" };
    } catch (e) {
        return { user: null, error: String(e) };
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
      throw e;
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
