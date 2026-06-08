#!/usr/bin/env node
/**
 * seed-demo.mjs — populate the running API with demo Seoul clinics + doctors.
 *
 * WHY: the architecture redesign intentionally ships with NO persistent seed
 * data (Korea-only, register-on-demand). With an in-memory DB (no MONGODB_URI)
 * the facility list starts empty, so Find Care shows nothing and nothing is
 * bookable. This script registers a realistic set of Seoul facilities through
 * the PUBLIC open-registration endpoints so the full "find care → book" loop
 * is demoable. Re-run after every API restart (in-memory data resets).
 *
 * USAGE:
 *   1. Start the API:  pnpm dev:api      (or pnpm dev)
 *   2. Run:            node scripts/seed-demo.mjs
 *   Optional:          API_URL=http://localhost:4000 node scripts/seed-demo.mjs --force
 *
 * Idempotency: skips if facilities already exist, unless --force is passed.
 */

const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const FORCE = process.argv.includes('--force');

// Coordinates are real Seoul locations. Specialties cover every category the
// MA Agent's CTA can detect, so any chat/image recommendation finds a match.
const FACILITIES = [
  {
    name: 'Seoul National University Hospital', type: 'hospital',
    address: '101 Daehak-ro, Jongno-gu', city: 'Seoul', lat: 37.5797, lng: 126.9988,
    phone: '+82 2-2072-2114',
    specialties: ['Cardiology', 'Neurology', 'Emergency', 'General Practice', 'Pulmonology'],
    doctors: [
      { name: 'Dr. Min-jun Kim', specialty: 'Cardiology', languages: ['Korean', 'English'] },
      { name: 'Dr. Seo-yeon Lee', specialty: 'Neurology', languages: ['Korean'] },
    ],
  },
  {
    name: 'Severance Hospital', type: 'hospital',
    address: '50-1 Yonsei-ro, Seodaemun-gu', city: 'Seoul', lat: 37.5623, lng: 126.9410,
    phone: '+82 2-1599-1004',
    specialties: ['Pulmonology', 'Respiratory', 'Cardiology', 'General Practice'],
    doctors: [
      { name: 'Dr. Ji-woo Park', specialty: 'Pulmonology', languages: ['Korean', 'English'] },
      { name: 'Dr. Ha-eun Jung', specialty: 'Respiratory', languages: ['Korean'] },
    ],
  },
  {
    name: 'Samsung Medical Center', type: 'hospital',
    address: '81 Irwon-ro, Gangnam-gu', city: 'Seoul', lat: 37.4881, lng: 127.0856,
    phone: '+82 2-3410-2114',
    specialties: ['Dermatology', 'Ophthalmology', 'General Practice'],
    doctors: [
      { name: 'Dr. Soo-ah Choi', specialty: 'Dermatology', languages: ['Korean', 'English'] },
      { name: 'Dr. Joon-ho Yoon', specialty: 'Ophthalmology', languages: ['Korean'] },
    ],
  },
  {
    name: 'Asan Medical Center', type: 'hospital',
    address: '88 Olympic-ro 43-gil, Songpa-gu', city: 'Seoul', lat: 37.5267, lng: 127.1080,
    phone: '+82 2-1688-7575',
    specialties: ['Cardiology', 'Neurology', 'Pediatrics', 'Emergency'],
    doctors: [
      { name: 'Dr. Hyun-woo Kang', specialty: 'Pediatrics', languages: ['Korean'] },
      { name: 'Dr. Na-rae Shin', specialty: 'Cardiology', languages: ['Korean', 'English'] },
    ],
  },
  {
    name: 'Gangnam Mind & Wellness Clinic', type: 'clinic',
    address: '423 Gangnam-daero, Gangnam-gu', city: 'Seoul', lat: 37.4979, lng: 127.0276,
    phone: '+82 2-555-0190',
    specialties: ['Mental Health', 'General Practice'],
    doctors: [
      { name: 'Dr. Eun-ji Han', specialty: 'Mental Health', languages: ['Korean', 'English'] },
    ],
  },
  {
    name: 'Myeongdong Family Clinic', type: 'clinic',
    address: '14 Myeongdong-gil, Jung-gu', city: 'Seoul', lat: 37.5636, lng: 126.9869,
    phone: '+82 2-318-0100',
    specialties: ['General Practice', 'Pediatrics', 'Urgent Care'],
    doctors: [
      { name: 'Dr. Tae-yang Oh', specialty: 'General Practice', languages: ['Korean', 'English'] },
    ],
  },
  {
    name: 'Seoul Skin & Derm Center', type: 'clinic',
    address: '45 World Cup buk-ro, Mapo-gu', city: 'Seoul', lat: 37.5560, lng: 126.9236,
    phone: '+82 2-336-7582',
    specialties: ['Dermatology'],
    doctors: [
      { name: 'Dr. Yu-jin Seo', specialty: 'Dermatology', languages: ['Korean'] },
    ],
  },
  {
    name: 'Hannam 24h Pharmacy', type: 'pharmacy',
    address: '736 Hannam-daero, Yongsan-gu', city: 'Seoul', lat: 37.5340, lng: 127.0026,
    phone: '+82 2-797-0119',
    specialties: [],
    doctors: [],
  },
];

async function api(path, opts) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts?.method || 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  // Confirm the API is reachable.
  try {
    const health = await api('/api/health');
    console.log(`✓ API up — db.connected=${health.db?.connected}, openrouter=${health.providers?.openrouter}`);
    if (!health.db?.connected) {
      console.log('  (in-memory mode — seed resets on API restart)');
    }
  } catch (e) {
    console.error(`✗ Cannot reach API at ${API}. Start it first: pnpm dev:api`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  // Idempotency guard.
  const existing = await api('/api/facilities');
  if ((existing.total ?? 0) > 0 && !FORCE) {
    console.log(`\n${existing.total} facilities already registered. Use --force to add the demo set anyway.`);
    return;
  }

  let fCount = 0, dCount = 0;
  for (const def of FACILITIES) {
    const { doctors = [], ...facility } = def;
    const { facility: created } = await api('/api/facilities', {
      method: 'POST',
      body: JSON.stringify(facility),
    });
    const id = created.id || created._id;
    fCount++;
    console.log(`+ ${facility.name}  [${facility.type}]  (${facility.specialties.join(', ') || 'pharmacy'})`);

    for (const doc of doctors) {
      await api(`/api/facilities/${id}/doctors`, {
        method: 'POST',
        body: JSON.stringify(doc),
      });
      dCount++;
      console.log(`    └ ${doc.name} — ${doc.specialty}`);
    }
  }

  const after = await api('/api/facilities');
  console.log(`\n✓ Seeded ${fCount} facilities + ${dCount} doctors. Find Care now lists ${after.total} facilities.`);
}

main().catch((e) => { console.error('\n✗ Seed failed:', e.message); process.exit(1); });
