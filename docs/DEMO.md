# MedAccess AI — 5-Minute Demo Script

> **Audience:** Judges / investors / technical reviewers.
> **Goal:** Walk the full patient → clinic loop live in ≤ 5 minutes.
> **Fallback:** `docs/demo-backup.mp4` (Mirsaid records before submission).

---

## Pre-flight checklist (do before starting the demo)

- [ ] `pnpm dev` running — patient app on `localhost:5174`, clinic on `localhost:5173`, API on `localhost:4000`
- [ ] `OPENROUTER_API_KEY` set in `.env` and live (`curl localhost:4000/api/health` → `providers.openrouter:true`). **A funded key — free tier rate-limits mid-demo.**
- [ ] **Seed the demo clinics:** `pnpm db:clean && node scripts/seed-demo.mjs` (Find Care is empty without this — 9 Seoul clinics + 14 demo doctors)
- [ ] Browser open, patient tab active, **Welcome screen visible** (clear localStorage first: DevTools → Application → Clear Site Data)
- [ ] Clinic tab open on `localhost:5173` → on the login screen tap **"Jump straight in → Doctor"** (guest entry, no password) → lands on the Patient Queue
- [ ] Mic permission granted (for voice mode demo)
- [ ] (Optional) Image sidecar running on `:5001` for live image analysis; if off, upload still returns text-only guidance

---

## Scene 1 — Patient onboarding (0:00 – 0:30)

**Say:** "Dilnoza is an Uzbek-speaking migrant worker in Seoul. She opens MedAccess AI for the first time — no account, no install, just a link, and it speaks her language."

1. Show the **Welcome screen** — animated logo, feature pills (AI triage · Voice · 12 languages · Private).
2. Tap **Get Started**.
3. Enter name: **Dilnoza**, phone: **any number** (links her records), language: **Uzbek**, city: **Seoul**.
4. Tap **Enter MedAccess AI** → lands on the Chat screen.

**Key point:** Phone links records across visits — no password, no account. Clinics are real Seoul facilities (the seeded demo set), so booking lands a real appointment.

---

## Scene 2 — AI symptom consultation (0:30 – 2:00)

**Say:** "Dilnoza describes her symptoms. The MA Agent triages, asks follow-up questions, and builds a clinical snapshot."

1. Type (or voice): `"Men 3 kundan beri isitmam bor, bosh og'riqi va ko'ngil aynish bor"` *(Uzbek: "I've had a fever for 3 days, headache and nausea")*
2. Wait for streaming response — show citation chips appearing inline.
3. Send follow-up: `"Haroratim 38.5°C"` *(38.5°C fever)*.
4. After 3 turns the **"Find Care →"** CTA card appears below the clinical snapshot — highlight:
   - Detected specialty (General Practice / Infectious Disease)
   - Urgency badge (Moderate / Urgent)
   - "Clinics near you" button

**Key points:**
- Streams in Uzbek — language auto-matched
- Citation chips link to clinical evidence (31-doc RAG corpus)
- No model name ever exposed ("MA Agent" identity held)

---

## Scene 3 — Voice mode (optional, 2:00 – 2:30)

**Say:** "For patients who can't type, the app has a full voice mode."

1. Tap the **headphones** icon in the chat bar → full-screen voice mode opens.
2. **Hold** the mic button, speak a symptom, **release** to send — show the avatar animation + live transcript.
3. The AI reply is read back aloud automatically.
4. Tap **X** to return to text chat (the conversation carries over).

---

## Scene 4 — Find Care + booking (2:30 – 3:15)

**Say:** "The patient taps the CTA and is taken directly to clinics near her, filtered by specialty."

1. Tap **Find Care →** from the CTA card (or navigate to the Find Care tab).
2. Show facility list — hospitals, clinics, pharmacies with verified badge, distance.
3. Expand a clinic → show doctor list with specialties.
4. Tap a doctor → **booking sheet** opens:
   - Pick a date (next 7 days, no Sundays)
   - Pick a time slot (fetched from API — 09:00–17:00, pre-filled working hours)
   - Confirm name, phone (pre-filled from profile)
5. Tap **Confirm Booking** → success toast.
6. Navigate to **Records → Appointments tab** — show the booked appointment with `pending` badge.

---

## Scene 5 — Clinic portal receives the referral (3:15 – 4:15)

**Say:** "On the other side — the clinic's doctor portal gets the referral instantly."

1. Switch to the **clinic browser tab** (`localhost:5173`).
2. Show the **Patients queue** — Dilnoza's referral appears with:
   - Urgency badge (color-coded)
   - MA Agent summary (symptoms, duration, triage level)
   - Specialty + contact info
3. Tap **Confirm Appointment** → status flips to `confirmed`.
4. Show the real-time polling badge (🟢 Live) and the last-updated timestamp.

**Key point:** Full loop — patient books → clinic sees → clinic confirms. No back-end manual work.

---

## Scene 6 — Image analysis (optional, 4:15 – 4:45)

**Say:** "Providers can also upload medical images directly in the chat for AI analysis."

1. Switch to the **clinic Reports tab** (or upload via the patient Chat 📷 button).
2. Upload a chest X-ray / skin / eye sample image.
3. Show the analysis — key observations, possible findings, suggested follow-up, disclaimer.
4. **Key point:** the image is read **only** by the local specialist sidecar (4 modalities, 27 conditions — 18 X-ray pathologies, 7 skin lesions, diabetic retinopathy, malaria); the LLM only narrates the text findings. The image never goes to a cloud model. If the sidecar is off, it degrades to text-only guidance.

---

## Scene 7 — Multilingual + settings (4:45 – 5:00)

**Say:** "Finally — language is a first-class feature."

1. Navigate to **Settings → Response language** — switch to Spanish.
2. Go back to Chat, send: `"Tengo fiebre y tos"`.
3. Show the AI responds in Spanish.
4. Switch back to English.

---

## Talking points (weave in naturally)

| Point | When |
|---|---|
| **$0 demo cost** — Qwen 3.6 Flash at $0.19/$1.13 per 1M tokens | Scene 2 |
| **31-doc RAG corpus** — WHO guidelines, clinical protocols, drug references | Scene 2 (citations) |
| **Installable PWA** — works offline, no App Store | Intro |
| **No stored PII** — all patient data in localStorage, cleared on reset | Scene 1 |
| **Specialist ML models LIVE** — 3 running (X-ray 18 pathologies, skin, diabetic retinopathy), image never leaves local infra | Scene 6 |
| **Open-source, MIT license** | Wrap-up |

---

## If something breaks

| Issue | Recovery |
|---|---|
| OpenRouter rate-limit | Switch `OPENROUTER_CHAT_MODEL` to backup key or `deepseek/deepseek-chat` |
| API not responding | Show `docs/demo-backup.mp4` (Mirsaid's backup) |
| Voice mode not working | Skip Scene 3 — mention "Web Speech API, no extra cost" |
| Booking 409 conflict | Pick a different time slot or a different doctor |
| White screen | Hard reload (Ctrl+Shift+R) |

---

## Assets needed (Sobirov fills in)

| Asset | Path | Status |
|---|---|---|
| Patient chat screenshot | `docs/screenshots/01-patient-chat.png` | 📋 |
| Voice mode screenshot | `docs/screenshots/02-patient-voice.png` | 📋 |
| Image upload screenshot | `docs/screenshots/03-patient-image-upload.png` | 📋 |
| Find Care CTA screenshot | `docs/screenshots/04-patient-connect-cta.png` | 📋 |
| Find Care list screenshot | `docs/screenshots/05-patient-find-care.png` | 📋 |
| Clinic queue screenshot | `docs/screenshots/06-clinic-patients-queue.png` | 📋 |
| Clinic interview screenshot | `docs/screenshots/07-clinic-interview.png` | 📋 |
| Clinic symptoms screenshot | `docs/screenshots/08-clinic-symptoms.png` | 📋 |
| Backup demo video | `docs/demo-backup.mp4` | 📋 Mirsaid |
