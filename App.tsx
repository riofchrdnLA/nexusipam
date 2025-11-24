
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SubnetManager } from './components/SubnetManager';
import { AIConsultant } from './components/AIConsultant';
import { Subnet, User } from './types';
import { generateMockSubnet } from './services/ipUtils';
import { StorageService } from './services/storage';
import { Shield, User as UserIcon, Lock, Database, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Login State
  const [email, setEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Load Data on Mount or User Change
  useEffect(() => {
    if (currentUser) {
        const loadData = async () => {
        setIsLoading(true);
        const data = await StorageService.getAllSubnets();
        setSubnets(data);
        setIsLoading(false);
        };
        loadData();
    }
  }, [currentUser]);

  const handleLogin = async (role: 'admin' | 'user') => {
      setIsLoggingIn(true);
      setLoginError(null);
      
      // Simulate email for role based demo if email empty
      const loginEmail = email || (role === 'admin' ? 'admin@nexus.com' : 'operator@nexus.com');
      
      const { user, error } = await StorageService.authLogin(loginEmail);
      
      if (user) {
          setCurrentUser(user);
      } else {
          setLoginError(error || "Login Failed");
      }
      setIsLoggingIn(false);
  };

  // Handle AI Auto-creation
  const handleAddSubnetFromAI = async (name: string, cidr: string) => {
    const records = generateMockSubnet(cidr, name);
    // Note: ID will be replaced by DB
    const newSubnet: Subnet = {
        id: Date.now().toString(), 
        name,
        cidr,
        gateway: cidr.split('/')[0],
        records
    };
    
    // Save to DB
    await StorageService.createSubnet(newSubnet);
    
    // Reload to get real ID from DB
    const updatedData = await StorageService.getAllSubnets();
    setSubnets(updatedData);
    setCurrentView('subnets');
  };

  const renderView = () => {
    if (!currentUser) return null;
    if (isLoading) return (
        <div className="flex h-full flex-col items-center justify-center text-cyan-400 space-y-4">
            <Loader2 className="animate-spin" size={48} />
            <p className="text-slate-400 animate-pulse">Syncing with Supabase Database...</p>
        </div>
    );

    switch(currentView) {
      case 'dashboard':
        return <Dashboard subnets={subnets} />;
      case 'subnets':
        return <SubnetManager subnets={subnets} setSubnets={setSubnets} currentUser={currentUser} />;
      case 'advisor':
        return <AIConsultant subnets={subnets} onAddSuggestion={handleAddSubnetFromAI} currentUser={currentUser} />;
      default:
        return <Dashboard subnets={subnets} />;
    }
  };

  // Login Screen Component
  if (!currentUser) {
      return (
          <div className="flex h-screen w-full bg-slate-950 items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">
                  {/* Background glow */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.6)]"></div>

                  <div className="text-center mb-8">
                      <div className="bg-cyan-500/10 p-4 rounded-full inline-block mb-4 border border-cyan-500/20">
                          <Lock className="text-cyan-400" size={48} />
                      </div>
                      <h1 className="text-3xl font-bold text-white tracking-wider mb-2">NEXUS<span className="text-cyan-400">IPAM</span></h1>
                      <div className="flex items-center justify-center space-x-2 text-emerald-400 text-xs mt-2 bg-emerald-950/30 py-1 px-3 rounded-full border border-emerald-900/50 inline-flex">
                        <Database size={12} />
                        <span>Supabase PostgreSQL Connected</span>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-slate-500 uppercase mb-1 block">Email Address</label>
                          <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-cyan-500 outline-none"
                          />
                          <p className="text-[10px] text-slate-500 mt-1 italic">* Use 'admin' in email for Admin Role, otherwise User Role.</p>
                      </div>

                      {loginError && (
                          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-center space-x-2 text-rose-400 text-sm">
                              <AlertCircle size={16} />
                              <span>{loginError}</span>
                          </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <button 
                            onClick={() => handleLogin('admin')}
                            disabled={isLoggingIn}
                            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 p-4 rounded-xl flex flex-col items-center justify-center group transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyan-500/50"
                        >
                            <div className="bg-rose-500/20 p-2 rounded-lg text-rose-400 mb-2 group-hover:scale-110 transition-transform">
                                {isLoggingIn ? <Loader2 className="animate-spin" size={24}/> : <Shield size={24} />}
                            </div>
                            <span className="text-white font-bold text-sm">Admin Login</span>
                        </button>

                        <button 
                            onClick={() => handleLogin('user')}
                            disabled={isLoggingIn}
                            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 p-4 rounded-xl flex flex-col items-center justify-center group transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyan-500/50"
                        >
                            <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400 mb-2 group-hover:scale-110 transition-transform">
                                {isLoggingIn ? <Loader2 className="animate-spin" size={24}/> : <UserIcon size={24} />}
                            </div>
                            <span className="text-white font-bold text-sm">Operator Login</span>
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
      />
      <main className="flex-1 p-8 overflow-hidden flex flex-col relative">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ 
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px'
        }}></div>
        
        {renderView()}
      </main>
    </div>
  );
};

export default App;
