import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Subnet, IPStatus, IPRecord } from '../types';

interface DashboardProps {
  subnets: Subnet[];
}

const COLORS = {
  [IPStatus.AVAILABLE]: '#10b981', // Emerald 500
  [IPStatus.RESERVED]: '#f43f5e',  // Rose 500
  [IPStatus.ACTIVE]: '#3b82f6',    // Blue 500
  [IPStatus.DHCP]: '#eab308',      // Yellow 500
  [IPStatus.OFFLINE]: '#64748b'    // Slate 500
};

export const Dashboard: React.FC<DashboardProps> = ({ subnets }) => {
  const stats = useMemo(() => {
    const data = {
      [IPStatus.AVAILABLE]: 0,
      [IPStatus.RESERVED]: 0,
      [IPStatus.ACTIVE]: 0,
      [IPStatus.DHCP]: 0,
      [IPStatus.OFFLINE]: 0
    };

    subnets.forEach(subnet => {
      (Object.values(subnet.records) as IPRecord[]).forEach(record => {
        data[record.status]++;
      });
    });

    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [subnets]);

  const topSubnets = useMemo(() => {
    return subnets.map(s => ({
      name: s.name,
      usage: ((Object.values(s.records) as IPRecord[]).filter(r => r.status !== IPStatus.AVAILABLE).length / Object.keys(s.records).length) * 100
    })).sort((a, b) => b.usage - a.usage).slice(0, 5);
  }, [subnets]);

  const totalIPs = stats.reduce((acc, curr) => acc + curr.value, 0);
  const usedIPs = stats.reduce((acc, curr) => curr.name !== IPStatus.AVAILABLE ? acc + curr.value : acc, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-slate-400 text-sm font-medium uppercase">Total Managed IPs</h3>
          <p className="text-4xl font-bold text-white mt-2">{totalIPs.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-slate-400 text-sm font-medium uppercase">Utilization Rate</h3>
          <p className="text-4xl font-bold text-cyan-400 mt-2">
            {totalIPs > 0 ? ((usedIPs / totalIPs) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-slate-400 text-sm font-medium uppercase">Total Subnets</h3>
          <p className="text-4xl font-bold text-emerald-400 mt-2">{subnets.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Global IP Status Distribution</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as IPStatus]} stroke="rgba(0,0,0,0)" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} 
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Top Utilized Subnets (%)</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSubnets} layout="vertical">
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fill: '#94a3b8'}} />
                <Tooltip 
                   cursor={{fill: 'transparent'}}
                   contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} 
                />
                <Bar dataKey="usage" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};