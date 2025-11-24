import React from 'react';
import { IPRecord, IPStatus } from '../types';

interface IPGridProps {
  records: Record<string, IPRecord>;
  onIPClick: (ip: string) => void;
}

export const IPGrid: React.FC<IPGridProps> = ({ records, onIPClick }) => {
  // Sort IPs correctly
  const sortedIPs = (Object.values(records) as IPRecord[]).sort((a, b) => {
    const numA = a.ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
    const numB = b.ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
    return numA - numB;
  });

  const getStatusColor = (status: IPStatus) => {
    switch (status) {
      case IPStatus.AVAILABLE: return 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/40 text-emerald-500';
      case IPStatus.RESERVED: return 'bg-rose-500/20 border-rose-500/50 hover:bg-rose-500/40 text-rose-500';
      case IPStatus.ACTIVE: return 'bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/40 text-blue-500';
      case IPStatus.DHCP: return 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/40 text-yellow-500';
      default: return 'bg-slate-700/50 border-slate-600 text-slate-400';
    }
  };

  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-16 gap-2">
      {sortedIPs.map((record) => {
        const lastOctet = record.ip.split('.')[3];
        return (
          <button
            key={record.ip}
            onClick={() => onIPClick(record.ip)}
            title={`${record.ip} - ${record.status}\n${record.hostname || ''}`}
            className={`
              aspect-square rounded border flex items-center justify-center text-xs font-mono transition-all duration-150
              ${getStatusColor(record.status)}
            `}
          >
            {lastOctet}
          </button>
        );
      })}
    </div>
  );
};