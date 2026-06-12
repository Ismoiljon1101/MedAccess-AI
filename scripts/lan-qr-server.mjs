// Showcase QR page — open this in a browser (project it on a screen) and students
// scan to open the apps on their phones.
//
//   pnpm qr:web            # serves http://localhost:5180
//
// Two modes, auto-detected:
//   • TUNNEL (preferred) — if `pnpm tunnel` is running, scripts/.tunnels.json holds
//     the public https://*.trycloudflare.com URLs. Shown here. Voice/camera/GPS work
//     on phones, over any internet, regardless of WiFi changes.
//   • LAN — otherwise, falls back to the current http://<lan-ip>:<port>. Follows WiFi
//     changes on its own (chat/booking work; voice/camera/GPS need the tunnel).
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { lanIp, PATIENT_PORT, CLINIC_PORT } from './lan-ip.mjs';

const PORT = Number(process.env.QR_WEB_PORT) || 5180;
const TUNNELS = path.join(path.dirname(fileURLToPath(import.meta.url)), '.tunnels.json');

/** Prefer live tunnel URLs; fall back to the current LAN IP. */
function targets() {
  try {
    const t = JSON.parse(fs.readFileSync(TUNNELS, 'utf8'));
    if (t.patient && t.clinic) {
      return { mode: 'tunnel', patient: t.patient, clinic: t.clinic, key: `${t.patient}|${t.clinic}` };
    }
  } catch {}
  const ip = lanIp();
  if (!ip) return { mode: 'none', key: 'none' };
  return { mode: 'lan', patient: `http://${ip}:${PATIENT_PORT}`, clinic: `http://${ip}:${CLINIC_PORT}`, ip, key: ip };
}

async function svg(text) {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

function card(label, emoji, url, qr) {
  return `
    <div class="card">
      <div class="label">${emoji} ${label}</div>
      <div class="qr">${qr}</div>
      <div class="url">${url}</div>
    </div>`;
}

async function page() {
  const t = targets();
  if (t.mode === 'none') {
    return `<!doctype html><meta http-equiv="refresh" content="3">
      <body style="background:#0b0f1a;color:#e2e8f0;font:600 22px system-ui;display:grid;place-items:center;height:100vh;margin:0">
      ⚠ No network detected — checking again…</body>`;
  }
  const [pq, cq] = await Promise.all([svg(t.patient), svg(t.clinic)]);
  const sub = t.mode === 'tunnel'
    ? `Secure HTTPS · voice, camera & GPS enabled · works on any network`
    : `Same WiFi only · network IP <span class="ip">${t.ip}</span> · voice needs <code>pnpm tunnel</code>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MedAccess AI — Scan to open</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; background:radial-gradient(1200px 600px at 50% -10%,#13203b,#0b0f1a);
         color:#e2e8f0; font-family:system-ui,-apple-system,Segoe UI,sans-serif;
         display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px; padding:32px; }
  h1 { font-size:clamp(24px,4vw,40px); margin:0; letter-spacing:-.02em; }
  h1 span { color:#38bdf8; }
  .sub { color:#94a3b8; margin:-14px 0 4px; font-size:clamp(14px,2vw,18px); }
  .sub code { color:#7dd3fc; font-family:ui-monospace,Menlo,monospace; }
  .cards { display:flex; gap:32px; flex-wrap:wrap; justify-content:center; }
  .card { background:#0f172a; border:1px solid #1e293b; border-radius:20px; padding:24px 24px 18px;
          width:min(360px,42vw); text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.4); }
  .label { font-size:clamp(18px,2.4vw,24px); font-weight:700; margin-bottom:16px; }
  .qr { background:#fff; border-radius:14px; padding:14px; }
  .qr svg { width:100%; height:auto; display:block; }
  .url { margin-top:14px; font-family:ui-monospace,Menlo,monospace; color:#7dd3fc; font-size:clamp(13px,1.6vw,16px); word-break:break-all; }
  .foot { color:#64748b; font-size:14px; text-align:center; }
  .ip { color:#cbd5e1; font-weight:600; }
</style></head>
<body>
  <h1>MedAccess <span>AI</span> — point your camera to open</h1>
  <div class="sub">${sub}</div>
  <div class="cards">
    ${card('Patient app', '📱', t.patient, pq)}
    ${card('Clinic app', '🩺', t.clinic, cq)}
  </div>
  <div class="foot">This screen updates itself when the URLs change — keep it open while you demo.</div>
  <script>
    let cur = ${JSON.stringify(t.key)};
    setInterval(async () => {
      try {
        const r = await fetch('/state'); const { key } = await r.json();
        if (key && key !== cur) location.reload();
      } catch {}
    }, 3000);
  </script>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/state') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ key: targets().key }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(await page());
});

server.listen(PORT, () => {
  const t = targets();
  console.log(`\n  QR showcase page → http://localhost:${PORT}`);
  console.log(`  mode: ${t.mode}${t.mode !== 'none' ? ` (${t.patient}, ${t.clinic})` : ''}`);
  if (t.mode === 'lan') console.log('  Tip: run `pnpm tunnel` for HTTPS so voice/camera/GPS work on phones.');
  console.log('  Open it in a browser and project it.\n');
});
