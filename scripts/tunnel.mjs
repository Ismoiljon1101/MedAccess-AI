// Cloudflare quick-tunnels for the patient + clinic apps. Gives each a public
// https://<random>.trycloudflare.com URL — real cert, so voice (mic), camera
// capture, and GPS all work on students' phones, over ANY internet (not just the
// same WiFi). No domain, no login, no Cloudflare account needed.
//
//   pnpm tunnel       # opens both tunnels, prints URLs, writes scripts/.tunnels.json
//
// The QR showcase page (pnpm qr:web) auto-detects .tunnels.json and shows these
// HTTPS URLs instead of the LAN IP. Stop with Ctrl+C (tunnels close, file cleared).
//
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATIENT_PORT, CLINIC_PORT } from './lan-ip.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '.tunnels.json');

// cloudflared: prefer PATH, fall back to the per-user install location.
function cloudflaredBin() {
  const local = path.join(os.homedir(), 'AppData', 'Local', 'cloudflared', 'cloudflared.exe');
  return fs.existsSync(local) ? local : 'cloudflared';
}

const urls = {};
const procs = [];

// Keep .tunnels.json in sync with reality: write it only while BOTH tunnels are
// up, otherwise remove it so the QR page falls back to LAN instead of showing
// dead tunnel URLs.
function persistTunnels() {
  if (urls.patient && urls.clinic) {
    fs.writeFileSync(OUT, JSON.stringify({ patient: urls.patient, clinic: urls.clinic, updatedAt: Date.now() }, null, 2));
  } else {
    try { fs.unlinkSync(OUT); } catch {}
  }
}

function startTunnel(name, port) {
  const p = spawn(cloudflaredBin(), ['tunnel', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  procs.push(p);
  const onData = (buf) => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !urls[name]) {
      urls[name] = m[0];
      persistTunnels();
      console.log(`  ${name.padEnd(8)} ${m[0]}`);
      if (urls.patient && urls.clinic) {
        console.log(`\n  Both tunnels live. QR page (pnpm qr:web) now shows these HTTPS URLs.`);
        console.log(`  Voice / camera / GPS will work on phones. Ctrl+C to stop.\n`);
      }
    }
  };
  p.stdout.on('data', onData);
  p.stderr.on('data', onData); // cloudflared prints the URL on stderr
  p.on('error', (err) => {
    delete urls[name];
    persistTunnels();
    console.error(`  [${name}] failed to start cloudflared: ${err.message}`);
  });
  p.on('exit', (code) => {
    delete urls[name];
    persistTunnels();
    console.warn(`  [${name}] cloudflared exited (${code})`);
  });
}

console.log('\n  Opening Cloudflare tunnels — this takes a few seconds…\n');
startTunnel('patient', PATIENT_PORT);
startTunnel('clinic', CLINIC_PORT);

function cleanup() {
  try { fs.unlinkSync(OUT); } catch {}
  for (const p of procs) { try { p.kill(); } catch {} }
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
