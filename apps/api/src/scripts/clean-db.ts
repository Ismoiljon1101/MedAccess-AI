/**
 * clean-db.ts — wipe demo/test data from MongoDB.
 *
 * Removes every test patient, appointment, slot, analysis, interview, and the
 * self-registered test facilities/doctors/accounts so the demo starts clean and
 * the agent only ever books against real, freshly-seeded records.
 *
 * Run:  pnpm db:clean      (then restart the API and re-run scripts/seed-demo.mjs)
 *
 * Pass --keep-accounts to preserve provider logins (Account collection).
 */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load the repo-root .env the same way the server does.
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

const KEEP_ACCOUNTS = process.argv.includes('--keep-accounts');

async function main() {
  const {
    connectDB, disconnectDB, dbReady,
    Patient, Appointment, TimeSlot, Interview,
    SymptomAnalysis, TriageResult, ReportAnalysis,
    Facility, Doctor, Account, Session,
  } = await import('@medaccess/db');

  await connectDB();
  if (!dbReady()) {
    console.error('✗ No MongoDB connection (set MONGODB_URI in .env). Nothing to clean.');
    process.exit(1);
  }

  const targets: Array<[string, { deleteMany: (f: object) => Promise<{ deletedCount?: number }> }]> = [
    ['patients',        Patient as any],
    ['appointments',    Appointment as any],
    ['timeslots',       TimeSlot as any],
    ['interviews',      Interview as any],
    ['symptomanalyses', SymptomAnalysis as any],
    ['triageresults',   TriageResult as any],
    ['reportanalyses',  ReportAnalysis as any],
    ['sessions',        Session as any],
    ['doctors',         Doctor as any],
    ['facilities',      Facility as any],
  ];
  if (!KEEP_ACCOUNTS) targets.push(['accounts', Account as any]);

  console.log('Cleaning demo data…\n');
  for (const [name, model] of targets) {
    try {
      const { deletedCount } = await model.deleteMany({});
      console.log(`  − ${name.padEnd(16)} removed ${deletedCount ?? 0}`);
    } catch (e: any) {
      console.warn(`  ! ${name.padEnd(16)} ${e.message}`);
    }
  }

  console.log('\n✓ Clean. Next: restart the API, then `node scripts/seed-demo.mjs` for fresh Seoul clinics.');
  if (KEEP_ACCOUNTS) console.log('  (provider accounts preserved)');
  await disconnectDB();
  process.exit(0);
}

main().catch((e) => { console.error('✗ Clean failed:', e); process.exit(1); });
