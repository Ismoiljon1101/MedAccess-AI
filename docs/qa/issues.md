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
- **Owner:** Ismail
- **Status:** assigned
- **Notes:** Fix options:
  - (A) When no Tier 1 results AND Tier 2 fails, show "No in-network clinics nearby — search by city instead" with city search pre-focused. Don't leave empty screen.
  - (B) Soft-apply specialty filter: show all in-network facilities first when specialty filter returns zero, with a note "No {specialty} specialists found — showing all nearby clinics"
  - (C) Mirsaid: procure Google Maps API key → Tier 2 will automatically show Seoul hospitals
  - **Immediate fix (no API key needed):** When specialty filter returns 0 results, clear it and reload without specialty filter. Show a banner: "No Pulmonology specialists in our network near you — showing all nearby clinics"

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
