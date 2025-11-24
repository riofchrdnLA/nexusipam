import { IPRecord, IPStatus } from "../types";

// Simple IP string to number converter
export const ipToLong = (ip: string): number => {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

// Number to IP string converter
export const longToIp = (long: number): string => {
  return [
    (long >>> 24) & 0xff,
    (long >>> 16) & 0xff,
    (long >>> 8) & 0xff,
    long & 0xff,
  ].join('.');
};

// Parse CIDR to get range (Simplified for demo, works best with /24, /23 etc)
export const getIPRange = (cidr: string): string[] => {
  const [ip, maskStr] = cidr.split('/');
  const mask = parseInt(maskStr, 10);
  
  if (isNaN(mask) || mask < 24 || mask > 32) {
    // For this visual demo, we restrict to smaller subnets to avoid browser freezing on huge arrays
    return [];
  }

  const ipLong = ipToLong(ip);
  const maskLong = -1 << (32 - mask);
  const networkLong = ipLong & maskLong;
  const broadcastLong = networkLong + ~maskLong;

  const ips: string[] = [];
  // Start from network + 1 (gateway usually) to broadcast - 1
  for (let i = networkLong + 1; i < broadcastLong; i++) {
    ips.push(longToIp(i));
  }
  return ips;
};

export const isValidCIDR = (cidr: string): boolean => {
  const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/;
  return cidrRegex.test(cidr);
};

export const generateMockSubnet = (cidr: string, name: string): Record<string, IPRecord> => {
  const ips = getIPRange(cidr);
  const records: Record<string, IPRecord> = {};
  
  ips.forEach((ip, index) => {
    // Randomly assign status for demo purposes
    const rand = Math.random();
    let status = IPStatus.AVAILABLE;
    if (rand > 0.8) status = IPStatus.ACTIVE;
    else if (rand > 0.7) status = IPStatus.RESERVED;
    else if (rand > 0.65) status = IPStatus.DHCP;

    records[ip] = {
      ip,
      status,
      hostname: status === IPStatus.ACTIVE ? `host-${index}.local` : undefined,
      lastUpdated: Date.now()
    };
  });
  return records;
};