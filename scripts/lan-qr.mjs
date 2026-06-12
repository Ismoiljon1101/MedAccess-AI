// LAN QR helper — prints scannable QR codes for the current WiFi IP so students
// can open the apps on their phones without typing anything.
//
// Why: `host: true` in both vite configs means the dev servers bind 0.0.0.0, so
// they follow whatever IP the WiFi hands out — no restart needed when the network
// changes. The only thing that changes is the URL to share. This script reads the
// live IP every run, so after switching WiFi you just re-run it for a fresh QR.
//
//   pnpm qr            # print QR once
//   pnpm qr --watch    # re-print whenever the LAN IP changes
//
import qrcode from 'qrcode-terminal';
import { lanIp, PATIENT_PORT, CLINIC_PORT } from './lan-ip.mjs';

function show(ip) {
  console.clear();
  if (!ip) {
    console.log('\n  ⚠ No LAN IPv4 found — are you connected to WiFi?\n');
    return;
  }
  const patient = `http://${ip}:${PATIENT_PORT}`;
  const clinic = `http://${ip}:${CLINIC_PORT}`;
  console.log(`\n  MedAccess AI on the LAN — scan with a phone camera\n`);
  console.log(`  📱 PATIENT  ${patient}`);
  qrcode.generate(patient, { small: true });
  console.log(`  🩺 CLINIC   ${clinic}`);
  qrcode.generate(clinic, { small: true });
  console.log(`  WiFi changed? Just re-run  pnpm qr  for a fresh code.\n`);
}

const watch = process.argv.includes('--watch');
let last = lanIp();
show(last);

if (watch) {
  setInterval(() => {
    const now = lanIp();
    if (now !== last) {
      last = now;
      show(now);
    }
  }, 3000);
}
