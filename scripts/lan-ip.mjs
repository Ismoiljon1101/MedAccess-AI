// Shared LAN IPv4 detection used by the QR helpers.
// `host: true` in both vite configs means the dev servers bind 0.0.0.0 and follow
// whatever IP the WiFi assigns — this just reports the current one to share.
import os from 'node:os';

/** Pick the most-likely LAN IPv4, skipping loopback, link-local, and Tailscale. */
export function lanIp() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (a.address.startsWith('169.254.')) continue; // link-local (no DHCP)
      const [o1, o2] = a.address.split('.').map(Number);
      if (o1 === 100 && o2 >= 64 && o2 <= 127) continue; // Tailscale CGNAT 100.64/10
      // rank: 192.168.x best, then 172.16–31.x, then 10.x, else last
      let rank = 9;
      if (o1 === 192 && o2 === 168) rank = 0;
      else if (o1 === 172 && o2 >= 16 && o2 <= 31) rank = 1;
      else if (o1 === 10) rank = 2;
      candidates.push({ ip: a.address, name, rank });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank);
  return candidates[0]?.ip ?? null;
}

export const PATIENT_PORT = 5174;
export const CLINIC_PORT = 5173;
