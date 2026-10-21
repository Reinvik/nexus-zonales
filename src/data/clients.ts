import rawClients from './clients.json';
import rawTransports from './transports.json';
import { ClientInfo } from '../types';

export const CLIENTS_LIST: ClientInfo[] = Object.entries(rawClients as Record<string, string>).map(([code, name]) => ({
  code,
  name
}));

export const TRANSPORTS_LIST: string[] = (rawTransports as string[]).filter(t => t && t.length > 1).sort();

export const getClientNameByCode = (code: string): string | undefined => {
  const clean = code.trim();
  const found = CLIENTS_LIST.find(c => c.code === clean);
  return found?.name;
};

export const searchClients = (query: string): ClientInfo[] => {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];
  return CLIENTS_LIST.filter(c => 
    c.code.toLowerCase().includes(q) || 
    c.name.toLowerCase().includes(q)
  ).slice(0, 8);
};

export const searchTransports = (query: string): string[] => {
  const q = query.trim().toLowerCase();
  if (!q) return TRANSPORTS_LIST.slice(0, 8);
  return TRANSPORTS_LIST.filter(t => t.toLowerCase().includes(q)).slice(0, 8);
};
