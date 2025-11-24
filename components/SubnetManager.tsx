import React, { useState, useMemo } from 'react';
import { Subnet, IPRecord, IPStatus, User } from '../types';
import { IPGrid } from './IPGrid';
import { generateEmptySubnet, isValidCIDR } from '../services/ipUtils';
import { StorageService } from '../services/storage';
import { Plus, Search, Map, List, Save, Trash2, X, Lock, Eye, Loader2, Database, Network } from 'lucide-react';

interface SubnetManagerProps {
  subnets: Subnet[];
  setSubnets: React.Dispatch<React.SetStateAction<Subnet[]>>;
  currentUser: User;
}

export const SubnetManager: React.FC<SubnetManagerProps> = ({ subnets, setSubnets, currentUser }) => {
  const [selectedSubnetId, setSelectedSubnetId] = useState<string | null>(subnets[0]?.id || null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubnetData, setNewSubnetData] = useState({ name: '', cidr: '', vlan: '' });
  const [selectedIP, setSelectedIP] = useState<IPRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync selected ID if subnets change (e.g. from realtime update)
  React.useEffect(() => {
    if (!selectedSubnetId && subnets.length > 0) {
        setSelectedSubnetId(subnets[0].id);
    } else if (selectedSubnetId && !subnets.find(s => s.id === selectedSubnetId) && subnets.length > 0) {
        setSelectedSubnetId(subnets[0].id);
    }
  }, [subnets, selectedSubnetId]);

  const activeSubnet = subnets.find(s => s.id === selectedSubnetId);
  const isAdmin = currentUser.role === 'admin';

  // Filter logic
  const filteredRecords = useMemo(() => {
    if (!activeSubnet) return {};
    if (!searchQuery.trim()) return activeSubnet.records;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, IPRecord> = {};

    Object.values(activeSubnet.records as Record<string, IPRecord>).forEach((record) => {
        if (
            record.ip.includes(query) ||
            (record.hostname && record.hostname.toLowerCase().includes(query)) ||
            (record.owner && record.owner.toLowerCase().includes(query)) ||
            (record.description && record.description.toLowerCase().includes(query))
        ) {
            filtered[record.ip] = record;
        }
    });

    return filtered;
  }, [activeSubnet, searchQuery]);

  const handleCreateSubnet = async () => {
    if (!newSubnetData.name || !isValidCIDR(newSubnetData.cidr)) {
        alert("Invalid Data");
        return;
    }
    
    setIsSaving(true);
    // Use generateEmptySubnet to ensure all IPs are AVAILABLE
    const records = generateEmptySubnet(newSubnetData.cidr);
    
    // Temporary ID for optimistic UI, will be ignored by DB insert logic
    const tempId = Date.now().toString();

    const newSubnet: Subnet = {
      id: tempId,
      name: newSubnetData.name,
      cidr: newSubnetData.cidr,
      gateway: newSubnetData.cidr.split('/')[0],
      vlan: parseInt(newSubnetData.vlan) || 0,
      records
    };

    try {
        // Save to DB
        await StorageService.createSubnet(newSubnet);
        // Note: We don't manually setSubnets here because the Realtime Subscription in App.tsx 
        // will automatically fetch the new valid data from DB.
        setShowAddModal(false);
        setNewSubnetData({ name: '', cidr: '', vlan: '' });
    } catch (error) {
        console.error("Failed to create subnet:", error);
        alert("Failed to create subnet. Please check console.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleUpdateIP = async (updatedRecord: IPRecord) => {
    if (!activeSubnet) return;
    
    setIsSaving(true);
    // For User Role: Force status to RESERVED if they are reserving
    if (!isAdmin && updatedRecord.status === IPStatus.AVAILABLE) {
        updatedRecord.status = IPStatus.RESERVED;
    }

    const updatedSubnet = {
        ...activeSubnet,
        records: {
            ...activeSubnet.records,
            [updatedRecord.ip]: updatedRecord
        }
    };

    // Save to DB
    await StorageService.updateIP(activeSubnet.id, updatedRecord);

    // Optimistic update
    setSubnets(subnets.map(s => s.id === activeSubnet.id ? updatedSubnet : s));
    setSelectedIP(null);
    setIsSaving(false);
  };

  const deleteSubnet = async (id: string) => {
      if(confirm('Are you sure you want to delete this subnet?')) {
          await StorageService.deleteSubnet(id);
          // Optimistic
          setSubnets(subnets.filter(s => s.id !== id));
          if (selectedSubnetId === id) setSelectedSubnetId(null);
      }
  }

  const canEditIP = (ip: IPRecord) => {
      if (isAdmin) return true;
      return ip.status === IPStatus.AVAILABLE;
  };

  // EMPTY STATE (No Subnets in Database)
  if (subnets.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="bg-slate-900 p-8 rounded-full border border-slate-800 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                  <Network className="text-slate-600" size={64} />
              </div>
              <div>
                  <h2 className="text-2xl font-bold text-white">Database is Empty</h2>
                  <p className="text-slate-400 mt-2 max-w-md">There are no subnets configured in the Nexus IPAM database yet.</p>
              </div>
              
              {isAdmin ? (
                  <button 
                      onClick={() => setShowAddModal(true)}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg flex items-center space-x-2 font-medium transition-all hover:scale-105"
                  >
                      <Plus size={20} /> <span>Create First Subnet</span>
                  </button>
              ) : (
                  <div className="bg-slate-800 px-4 py-2 rounded text-slate-400 text-sm">
                      Waiting for Administrator to configure networks...
                  </div>
              )}

              {/* Add Subnet Modal (Copy for Empty State) */}
              {showAddModal && isAdmin && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 text-left">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-white">New Subnet</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                                    placeholder="e.g. Server Farm A"
                                    value={newSubnetData.name}
                                    onChange={(e) => setNewSubnetData({...newSubnetData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">CIDR (IPv4)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                                    placeholder="e.g. 192.168.10.0/24"
                                    value={newSubnetData.cidr}
                                    onChange={(e) => setNewSubnetData({...newSubnetData, cidr: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">VLAN ID (Optional)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                                    value={newSubnetData.vlan}
                                    onChange={(e) => setNewSubnetData({...newSubnetData, vlan: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                            <button 
                                onClick={handleCreateSubnet} 
                                disabled={isSaving}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded flex items-center"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={16} /> : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
              )}
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Controls */}
      <div className="flex flex-wrap gap-4 justify-between items-center bg-slate-900 p-4 rounded-lg border border-slate-800">
        <div className="flex items-center space-x-4">
            <select 
                className="bg-slate-800 border-slate-700 text-white rounded p-2 min-w-[200px] outline-none focus:ring-1 focus:ring-cyan-500"
                value={selectedSubnetId || ''}
                onChange={(e) => {
                    setSelectedSubnetId(e.target.value);
                    setSearchQuery('');
                }}
            >
                {subnets.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.cidr})</option>
                ))}
            </select>
            
            <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search IP, Host, Owner..." 
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-cyan-500 w-64 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {isAdmin && (
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded flex items-center space-x-1"
                >
                    <Plus size={16} /> <span className="hidden sm:inline">New Subnet</span>
                </button>
            )}
        </div>
        
        <div className="flex bg-slate-800 rounded p-1">
            <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-cyan-400' : 'text-slate-400'}`}
            >
                <Map size={18} />
            </button>
            <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700 text-cyan-400' : 'text-slate-400'}`}
            >
                <List size={18} />
            </button>
        </div>
      </div>

      <div className="md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
                type="text" 
                placeholder="Search IP, Host, Owner..." 
                className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-cyan-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-lg p-6 relative">
        {!activeSubnet ? (
            <div className="flex items-center justify-center h-full text-slate-500">
                Select or create a subnet to manage IPs
            </div>
        ) : (
            <>
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {activeSubnet.name}
                            {searchQuery && <span className="text-sm font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded-full">Filtered: {Object.keys(filteredRecords).length} results</span>}
                        </h2>
                        <div className="text-slate-400 flex flex-wrap gap-4 text-sm mt-1">
                            <span>CIDR: <span className="text-cyan-400 font-mono">{activeSubnet.cidr}</span></span>
                            <span>VLAN: <span className="text-emerald-400 font-mono">{activeSubnet.vlan || 'N/A'}</span></span>
                            <span>Total IPs: {Object.keys(activeSubnet.records).length}</span>
                        </div>
                    </div>
                    {isAdmin && (
                        <button onClick={() => deleteSubnet(activeSubnet.id)} className="text-rose-500 hover:text-rose-400 transition-colors">
                            <Trash2 size={20} />
                        </button>
                    )}
                </div>

                {Object.keys(filteredRecords).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Search size={48} className="mb-4 opacity-20" />
                        <p>No IPs found matching "{searchQuery}"</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <IPGrid 
                        records={filteredRecords} 
                        onIPClick={(ip) => setSelectedIP(filteredRecords[ip])} 
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-800 uppercase text-xs font-semibold text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">IP Address</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Hostname</th>
                                    <th className="px-4 py-3">Owner</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {(Object.values(filteredRecords) as IPRecord[]).sort((a, b) => {
                                    const numA = a.ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
                                    const numB = b.ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
                                    return numA - numB;
                                }).map(record => (
                                    <tr key={record.ip} className="hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-mono text-cyan-400">{record.ip}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                                ${record.status === IPStatus.AVAILABLE ? 'bg-emerald-500/10 text-emerald-500' : 
                                                  record.status === IPStatus.RESERVED ? 'bg-rose-500/10 text-rose-500' :
                                                  record.status === IPStatus.ACTIVE ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-700 text-slate-300'}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{record.hostname || '-'}</td>
                                        <td className="px-4 py-3">{record.owner || '-'}</td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => setSelectedIP(record)} className="text-cyan-400 hover:underline">
                                                {canEditIP(record) ? 'Edit' : 'View'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Add Subnet Modal */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-white">New Subnet</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Name</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                            placeholder="e.g. Server Farm A"
                            value={newSubnetData.name}
                            onChange={(e) => setNewSubnetData({...newSubnetData, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">CIDR (IPv4)</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                            placeholder="e.g. 192.168.10.0/24"
                            value={newSubnetData.cidr}
                            onChange={(e) => setNewSubnetData({...newSubnetData, cidr: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">VLAN ID (Optional)</label>
                        <input 
                            type="number" 
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500"
                            value={newSubnetData.vlan}
                            onChange={(e) => setNewSubnetData({...newSubnetData, vlan: e.target.value})}
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button 
                        onClick={handleCreateSubnet} 
                        disabled={isSaving}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded flex items-center"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : 'Create'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* IP Detail Modal */}
      {selectedIP && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
             <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-[500px] shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-mono text-cyan-400 font-bold">{selectedIP.ip}</h3>
                        {!canEditIP(selectedIP) && (
                            <span className="flex items-center gap-1 text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
                                <Eye size={12} /> Read Only
                            </span>
                        )}
                    </div>
                    <button onClick={() => setSelectedIP(null)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 uppercase mb-1">Status</label>
                            {isAdmin ? (
                                <select 
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none"
                                    value={selectedIP.status}
                                    onChange={(e) => setSelectedIP({...selectedIP, status: e.target.value as IPStatus})}
                                >
                                    {Object.values(IPStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            ) : (
                                <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded border border-slate-700/50 text-slate-300">
                                    {selectedIP.status === IPStatus.AVAILABLE ? (
                                        <span className="text-emerald-400 font-bold flex items-center gap-1">Available <Plus size={12}/></span>
                                    ) : (
                                        <span className="text-slate-300 flex items-center gap-1"><Lock size={12}/> {selectedIP.status}</span>
                                    )}
                                </div>
                            )}
                            {!isAdmin && selectedIP.status === IPStatus.AVAILABLE && (
                                <p className="text-[10px] text-cyan-400 mt-1">Saving will reserve this IP.</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 uppercase mb-1">Hostname</label>
                            <input 
                                type="text" 
                                disabled={!canEditIP(selectedIP)}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                value={selectedIP.hostname || ''}
                                onChange={(e) => setSelectedIP({...selectedIP, hostname: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 uppercase mb-1">Owner / Department</label>
                        <input 
                            type="text" 
                            disabled={!canEditIP(selectedIP)}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            value={selectedIP.owner || ''}
                            onChange={(e) => setSelectedIP({...selectedIP, owner: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 uppercase mb-1">Description</label>
                        <textarea 
                            disabled={!canEditIP(selectedIP)}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-cyan-500 h-24 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                            value={selectedIP.description || ''}
                            onChange={(e) => setSelectedIP({...selectedIP, description: e.target.value})}
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    {canEditIP(selectedIP) && (
                        <button 
                            onClick={() => handleUpdateIP(selectedIP)} 
                            disabled={isSaving}
                            className={`flex items-center space-x-2 px-6 py-2 rounded font-medium text-white
                                ${!isAdmin && selectedIP.status === IPStatus.AVAILABLE 
                                    ? 'bg-cyan-600 hover:bg-cyan-500' 
                                    : 'bg-emerald-600 hover:bg-emerald-500'}`}
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            <span>
                                {!isAdmin && selectedIP.status === IPStatus.AVAILABLE 
                                    ? 'Reserve IP' 
                                    : 'Save Changes'}
                            </span>
                        </button>
                    )}
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
