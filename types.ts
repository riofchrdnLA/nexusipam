export enum IPStatus {
  AVAILABLE = 'Available',
  RESERVED = 'Reserved',
  ACTIVE = 'Active',
  DHCP = 'DHCP',
  OFFLINE = 'Offline'
}

export interface IPRecord {
  ip: string;
  status: IPStatus;
  hostname?: string;
  macAddress?: string;
  owner?: string;
  description?: string;
  lastUpdated: number;
}

export interface Subnet {
  id: string;
  name: string;
  cidr: string; // e.g., 192.168.1.0/24
  gateway: string;
  vlan?: number;
  location?: string;
  records: Record<string, IPRecord>; // Key is the IP address
}

export interface AIAdvice {
  suggestion: string;
  config?: any;
}

export type UserRole = 'admin' | 'user';

export interface User {
  username: string;
  role: UserRole;
}