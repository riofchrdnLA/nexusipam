import React from 'react';
import { LayoutDashboard, Network, Settings, Cpu, Activity, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  currentUser: User;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentUser, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'subnets', label: 'Subnet Manager', icon: Network },
    { id: 'advisor', label: 'AI Consultant', icon: Cpu },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-6 flex items-center space-x-2 border-b border-slate-800">
        <Activity className="text-cyan-400" size={24} />
        <h1 className="text-xl font-bold text-white tracking-wider">NEXUS<span className="text-cyan-400">IPAM</span></h1>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentView === item.id 
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3 mb-3 flex items-center space-x-3">
            <div className={`p-2 rounded-full ${currentUser.role === 'admin' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {currentUser.role === 'admin' ? <Shield size={16} /> : <UserIcon size={16} />}
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{currentUser.username}</p>
                <p className="text-xs text-slate-500 uppercase">{currentUser.role}</p>
            </div>
        </div>
        <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-rose-400 text-sm py-2 transition-colors"
        >
            <LogOut size={16} />
            <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};