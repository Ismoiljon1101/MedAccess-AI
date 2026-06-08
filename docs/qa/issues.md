# MedAccess AI — QA Issue Tracker

> **Owner:** Mirsaid (file bugs). Engineers update status when assigned.
> **Format:** see [`docs/team/mirsaid.md`](../team/mirsaid.md) for the exact template.

---

## Severity scale

| Level | Meaning | Example |
|---|---|---|
| **SEV-1** | Blocker — app crashes, demo dies, data loss | API 500s on every chat request |
| **SEV-2** | Major — feature broken, workaround exists | Voice mode doesn't transcribe on Safari |
| **SEV-3** | Minor — visual glitch, slow, edge case | Citation chips overflow on long titles |
| **SEV-4** | Nit — polish, copy, single-pixel alignment | "your" should be "you're" on Settings page |

Sobirov pulls SEV-3 / SEV-4 with `owner: unassigned`. Otabek and Ismail handle SEV-1 / SEV-2.

---

## Status legend

- `open` — filed, not yet triaged
- `assigned` — someone is working on it (set owner)
- `in-pr` — fix is in a branch / pull request
- `fixed` — merged to develop
- `wontfix` — closed without a fix (add reason)
- `cantrepro` — bug not reproducible (Mirsaid retests, then closes if still gone)

---

## Open issues

## #001 · [SEV-2] FindCare shows "No facilities" outside Uzbekistan
- **Found on:** Patient app, Chrome, Windows, 2026-05-30
- **Repro:**
  1. Open patient app from a location outside Uzbekistan (e.g. Seoul, South Korea)
  2. Allow location access
  3. Navigate to Find Care
  4. Tap "Find Care →" CTA after image analysis (specialty pre-filled as "Pulmonology")
- **Expected:** Tier 2 Google Maps fallback fires and shows nearby hospitals in the user's actual city
- **Actual:** "No facilities found nearby" — empty state. GPS shows "Myeonmok-ro, Seoul, South Korea" but no clinics load because all 15 seed facilities are in Uzbekistan and none match the Pulmonology specialty filter
- **Root cause (two bugs):**
  1. Specialty pre-filter from CTA (`?specialty=Pulmonology`) is applied to both Tier 1 (in-network) AND Tier 2 (Google Maps). None of our seed facilities have Pulmonology → Tier 1 empty. Tier 2 fires but Google Maps API key is not configured → silent fail.
  2. Google Maps Places API key (`GOOGLE_MAPS_KEY`) not set in `.env` → Tier 2 always silently fails outside Uzbekistan.
- **Console errors:** none (Tier 2 failure is caught silently)
- **Screenshot:** `docs/screenshots/findcare_no_results_seoul.png`
- **Owner:** Ismail / Otabek
- **Status:** fixed
- **Notes:** Resolved by two parts, both now in place:
  - (B) **Soft specialty filter — DONE.** `FindCare.tsx` already retries without the specialty when it returns 0 and shows the "No {specialty} specialists in our network nearby — showing all available clinics" banner (`specialtyFallback`).
  - **Real root cause was no facility data, not the filter.** `/api/facilities` returned 0 because the redesign ships no persistent seed and the in-memory DB starts empty. Fixed with `scripts/seed-demo.mjs` (Otabek) — registers 8 Seoul clinics + 11 doctors via the public open-registration endpoints, covering every MA-Agent specialty. **Must be re-run after each API restart** unless `MONGODB_URI` is set. See TODO.md §2.5.
  - (C) Google/Naver Maps key still unset → Tier 2 map fallback stays in stub mode. Mirsaid to procure if real-world (non-network) results are wanted for the demo.

## #002 · [SEV-2] Clinic Patient Queue shows raw IDs instead of names for manual bookings
- **Found on:** Clinic app, 2026-06-08 (surfaced once demo facilities were seeded)
- **Repro:**
  1. Seed facilities (`node scripts/seed-demo.mjs`), then book via patient Find Care (or `POST /api/appointments`)
  2. Open clinic app → Patient Queue
- **Expected:** Queue row shows patient name, doctor name, facility name
- **Actual:** `GET /api/appointments` (the `getQueue` path in `appointment.service.ts`) returns `patientId` / `doctorId` / `facilityId` only — no `patientName` / `doctorName` / `facilityName` / `patientPhone`. `Patients.tsx` reads `ref.patientName` etc., so those render blank. The agent-booking path populates `agentAnalysis`; the manual `book()` path does not join names.
- **Console errors:** none
- **Owner:** Ismail (fix is in `appointment.service.ts getQueue` — gated service, needs his sign-off)
- **Status:** open
- **Notes:** Fix = populate name fields in `getQueue` (join Doctor/Facility/Patient, both DB and in-memory branches). Frontend could add a fallback (`ref.patientName ?? ref.patientPhone ?? 'Patient'`) as a stopgap — Otabek can do that ungated if wanted.

## #003 · [SEV-1] OPENROUTER_API_KEY empty → entire AI core dead
- **Found on:** All apps, 2026-06-08 (local `.env`)
- **Repro:** `curl localhost:4000/api/health` → `providers.openrouter:false`. Chat/symptoms/triage/reports all fail.
- **Expected:** AI features stream responses
- **Actual:** No key set in `.env`, so the LLM gateway is disabled. This is the single biggest demo blocker.
- **Owner:** Mirsaid (procure OpenRouter key) → Ismail (install in `.env`)
- **Status:** open
- **Notes:** Not code — purely an env/credential gap. Nothing in the AI half of the loop can be verified until this is set.

## #004 · [SEV-4] TODO §4 endpoint checklist references removed `/api/clinics`
- **Found on:** Docs, 2026-06-08
- **Repro:** `curl localhost:4000/api/clinics` → 404. Routes were renamed to `/api/facilities` + `/api/appointments` in the MVC redesign.
- **Owner:** unassigned (Sobirov-friendly doc fix)
- **Status:** open
- **Notes:** Update the §4 Endpoint Verification Checklist in TODO.md to the current route names (`/api/facilities`, `/api/appointments`, `/api/maps`).

<!--
Template — copy this for each new bug:

## #001 · [SEV-X] Short title (under 60 chars)
- **Found on:** App, browser, OS, date
- **Repro:** Numbered steps
- **Expected:** What should happen
- **Actual:** What happens
- **Console errors:** Paste relevant errors, or "none"
- **Screenshot:** path or link (optional but encouraged)
- **Owner:** name or `unassigned`
- **Status:** open / assigned / in-pr / fixed / wontfix / cantrepro
- **Notes:** Free-form
-->

---

## Resolved (most recent first)

_Empty._
