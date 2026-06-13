# MedAccess AI — Team Task Tracker

> **Mission:** Ship an AI Doctor Copilot for rural & underserved areas that *closes the loop* — patient gets a structured read AND reaches a real clinic.
>
> **Single source of truth for API contracts:** `packages/shared/src/schemas.ts`.
> **For the *why* behind every decision:** [README.md](./README.md).
> **For who owns what:** [`docs/team/`](./docs/team/) + this file's §2 Team & Ownership.
> **For agent rules:** [`CLAUDE.md`](./CLAUDE.md) (every agent reads this before touching anything).

---

## ✅ Architecture redesign complete (2026-06-04)

Ismail reviewed and rewrote the entire architecture. All concerns resolved:

- **ER model**: 10 unused models deleted (Clinic, Referral, User, Role, Permission, Medication, Allergy, Condition, Encounter, Vitals). Single source of truth: `Facility` (not Clinic). All refs are ObjectId.
- **Agent booking**: chat → `booking_proposal` SSE → patient confirms → `POST /api/appointments/confirm` → Appointment in DB with full `agentAnalysis` refs.
- **MVC**: 4 domain services (patient, facility, appointment, agent-booking). Thin controllers. `clinics.ts` + `register.ts` deleted.
- **Patient identity**: phone-based (no auth). `POST /api/patients` on Welcome. `X-Patient-Phone` header on all requests.
- **Registration**: open (no approval). Clinic + doctor register immediately active.
- **Market**: Korea only. Naver Maps default. No seed data. No Uzbekistan.
- **Skin model**: **EfficientNet-B0 (95.5%)** — locked. Owner: Temirlan.

---

## 0 · Status Dashboard

| Phase | Status |
|---|---|
| Monorepo scaffold + tooling | ✅ Done |
| `packages/shared` (schemas, prompts, 31 RAG docs) | ✅ Done |
| `packages/db` — MVC schema redesign (12 models, 10 deleted) | ✅ Done (Ismail, 2026-06-04) |
| `apps/api` — MVC service layer + thin controllers + agent booking | ✅ Done (Ismail, 2026-06-04) |
| `apps/clinic` (provider UI + Patients queue + all 4 modules) | ✅ Done |
| `apps/patient` (PWA, phone identity, agent booking UI, Korea defaults) | ✅ Done |
| Agent booking loop: chat → proposal SSE → confirm → clinic sees | ✅ Done (Ismail, 2026-06-04) |
| FindCare: My Appointments (server-linked) + manual search | ✅ Done (Ismail, 2026-06-04) |
| Clinic queue reads `Appointment` (with `agentAnalysis` populated) | ✅ Done (Ismail, 2026-06-04) |
| Per-engineer agent files (`CLAUDE.md` + `docs/team/`) | ✅ Done |
| Python image-ml sidecar (scaffold + contract) | ✅ Done — running on :5001 |
| Research folder (`research/`) | ✅ Done |
| Cheapest LLM switch — Qwen 3.x | ✅ Done (Ismail) |
| Patient image-quality guidance modal + checklist | ✅ Done (Otabek) |
| Vision pipeline — local models only, no cloud vision | ✅ Done (Ismail) |
| Image analysis → agent-triggered booking | ✅ Done (Ismail) |
| FindCare GPS + OSM map view + list/map toggle | ✅ Done (Otabek) |
| Korea/Naver defaults — no Uzbekistan seed data | ✅ Done (Ismail, 2026-06-04) |
| Image thumbnails in chat | ✅ Done (Otabek) |
| Specialist disease models: **YOLOv8s-Malaria** (Phase 1, MIT) | ⚠️ Weight present — `services/image-ml/models/malaria-yolov8s.pt` (6 MB) is on disk (earlier 401 resolved). **Temirlan: verify it loads + add an eval result before the demo.** |
| Specialist disease models: **TorchXRayVision DenseNet121-all** X-ray (Phase 2) | ✅ **Live on :5001** — auto-fetches weights from xrv CDN on first call |
| Specialist disease models: **EfficientNet-B0** skin (Phase 3, 95.5%) | ⚠️ Temirlan's preferred model still pending ONNX conversion; **temporarily replaced with ConvNeXt-Base HAM10000** (`Ratnakar01/...`, 334 MB, auto-downloaded, accuracy TBD) so the skin path is demoable now. |
| Specialist disease models: **Diabetic-retinopathy** (eye fundus, binary) | ✅ **Live on :5001** — `BlairFerg/diabetic-retinopathy-detection.onnx`, 214 MB, auto-downloaded |
| Image-ML auto-pull-on-boot (`model_manager.py`) | ✅ Done — `uvicorn main:app` downloads any missing weights, then serves; failures are non-fatal (`skipped:true`) |
| `pnpm typecheck` clean across all workspaces | ✅ Done (Ismail, 2026-06-04) |
| Frontend design pass — both apps | 📋 Todo (Ismail, use `/frontend-design`) |
| PWA Lighthouse audit ≥ 90 | 📋 Todo (Otabek) |
| Screenshots + DEMO.md | 📋 Todo (Sobirov) |
| Tag `v0.1.0` + submit | 📋 Todo (Ismail) |

---

## 0.6 · Skin Disease Model — LOCKED

**Decision (Ismail, 2026-06-04): EfficientNet-B0 (95.5%)**

- Repo: [MahimaKhatri/Skin-Disease-Detection](https://github.com/MahimaKhatri/Skin-Disease-Detection)
- Task: clone repo → extract weights → convert to ONNX (`tf2onnx` or `torch.onnx.export`) → drop in `services/image-ml/models/` → wire into `/analyze` endpoint with `hint=skin`
- **Owner: Temirlan** — must run on x86/Mac (ARM64 Windows has no TF wheels)
- Status: 🔴 BLOCKED on ONNX conversion machine

---

## 0.5 · Strategy (as of 2026-05-28)

Two strategic shifts since the original plan:

### A) Pareto-focused accuracy, not breadth — **research done, decisions locked**

See [`research/00-overview.md`](./research/00-overview.md) for the executive summary and [`research/Medical ML for Rural Settings.md`](./research/Medical%20ML%20for%20Rural%20Settings.md) for the full annotated report with citations.

**Top 5 diseases (locked):** Malaria · Pneumonia · Skin lesions · Diabetic retinopathy · Scabies.

**Models chosen per disease:**
| Phase | Disease | Model | License | Status |
|---|---|---|---|---|
| 1 | Malaria | YOLOv8n-Malaria (NIH smear) | MIT ✅ | Ship first |
| 2 | Pneumonia | TorchXRayVision DenseNet121 | Apache 2.0 ✅ | Needs alignment UI |
| 3 | Skin lesions | **EfficientNet-B0** (95.5%) | Open ✅ | 🔴 ONNX conversion pending (Temirlan) |
| 4 | Retinopathy | ResNet50-DR | Non-commercial ⚠️ | Non-profit only |
| 5 | Scabies | MobileNetV2-ScabAI | Non-commercial ⚠️ | ❌ Deferred (dataset too small) |

**Architecture locked:** Local Python sidecar (`services/image-ml/`) — already scaffolded. Browser WASM explicitly rejected (single-thread, 1.5–3s latency, crashes). Native mobile wrapper (ONNX Runtime Mobile + NNAPI/CoreML) is the post-MVP path.

### B) Cheap stack, not premium stack

Budget is tight. Switching from Claude Sonnet 4.5 (~$3/1M tok) to Chinese / free models:

- **Qwen 3.6 Plus** — free during preview, 1M context (primary chat + vision)
- **Qwen 3.5 Flash** — $0.065/$0.26 (fast path)
- **MiMo / Step / DeepSeek free tiers** — backup

We accept slightly worse general intelligence in exchange for $0 demo cost. Specialist image models close the medical accuracy gap that cheaper LLMs open.

### C) Patient-side image quality is REQUIRED (research-confirmed)

Research is explicit: every chosen specialist model loses **15–25% accuracy** on non-curated phone photos vs benchmark. An interactive capture interface is not optional — it's a prerequisite for the specialist models to perform as advertised.

Required components (Otabek):
- Pre-upload alignment overlay (positioning template per modality)
- Client-side blur / glare / brightness gate (block submit if image fails)
- Post-capture checklist + retake flow

---

## 1 · Locked Architecture (do not relitigate)

| | |
|---|---|
| Package manager | **pnpm** workspaces only — no `npm install` |
| Language | **TypeScript strict** (Node + both apps); **Python 3.11 strict typing** (image-ml sidecar) |
| Backend | Express + TS, Zod-validated, OpenAI SDK pointed at OpenRouter |
| Image ML sidecar | **FastAPI** in `services/image-ml/` — specialist CV models. Optional (Node degrades gracefully if `IMAGE_ML_URL` unset). |
| Databases | **MongoDB** (persistent) via `packages/db` + Mongoose; in-memory fallback |
| Frontend (Clinic) | Vite + React 18 + TS + Tailwind + PWA + Zustand |
| Frontend (Patient) | Vite + React 18 + TS + Tailwind + PWA + Zustand |
| LLM provider | **OpenRouter** (single `OPENROUTER_API_KEY`) |
| Vision model | `OPENROUTER_VISION_MODEL` — upgrading to `anthropic/claude-sonnet-4-5` |
| Voice (STT) | Web Speech API (primary) + OpenAI Whisper (optional fallback) + LiveKit voice mode |
| Voice (TTS) | Web Speech API (browser native) |
| RAG | BM25 keyword similarity over **31 seed clinical docs** |
| Env file | Single root `.env` (loaded by `apps/api/src/server.ts`) |
| Identity | Patient sees "MA Agent" — model/provider never exposed |

---

## 2 · Team & Ownership

> Each engineer has a dedicated file in [`docs/team/`](./docs/team/). The agent (Claude / Cursor / Codex) loads it after asking "which team member am I helping?". See [`CLAUDE.md`](./CLAUDE.md) §1.

| Member | Role | Lane | File |
|---|---|---|---|
| **Ismail** | CTO / lead engineer | Architecture, integrations, system prompts, code review, releases | [`docs/team/ismail.md`](./docs/team/ismail.md) |
| **Mirsaid** | Ops + QA | API keys, MongoDB Atlas, LiveKit, deployment, manual QA | [`docs/team/mirsaid.md`](./docs/team/mirsaid.md) |
| **Temirlan** | Python ML | `services/image-ml/` — skin / chest X-ray / eye specialist models | [`docs/team/temirlan.md`](./docs/team/temirlan.md) |
| **Otabek** | TS shipper | Patient + clinic UI features, polish, PWA, vision-upgrade smoke tests | [`docs/team/otabek.md`](./docs/team/otabek.md) |
| **Sobirov** | Freshman (guided) | Screenshots, docs, copy, `aria-label`, SEV-3/4 bugs from QA inbox | [`docs/team/sobirov.md`](./docs/team/sobirov.md) |

**Escalation rule (soft gate):** if anyone is about to edit an architectural file (see [`CLAUDE.md`](./CLAUDE.md) §4), the agent warns: *"This touches architecture owned by Ismail. Did he sign off?"* and proceeds only on confirmation.

---

## 2.5 · 🧪 Feature Test Protocol (READ THIS BEFORE TOUCHING CODE)

> **Ismail's standing order:** Before writing any new feature or fix, every team member must first test the features below, record pass/fail in [`docs/qa/issues.md`](./docs/qa/issues.md) using the bug template, then fix what's broken, then push to `develop`.

### How to start the app
```bash
git pull origin develop
pnpm install
cp .env.example .env   # fill OPENROUTER_API_KEY — ask Ismail (REQUIRED for chat/symptoms/triage/reports)

# Image-ML sidecar (specialist medical vision: skin/eye/X-ray). Optional but
# strongly recommended — without it, image analysis is "skipped".
cd services/image-ml
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn main:app --port 5001
# (auto-downloads ~550 MB of weights on first boot; idempotent thereafter)
cd ../..

pnpm dev                       # starts API :4000, clinic :5173, patient :5174
node scripts/seed-demo.mjs     # populate demo Seoul clinics — AFTER API is up
```

> ⚠️ **Two gotchas that make the demo look broken:**
> 1. **No `OPENROUTER_API_KEY`** → chat, symptoms, triage, and image analysis all fail silently (the entire AI core). `/api/health` shows `providers.openrouter:false`. Mirsaid procures, Ismail installs.
> 2. **Find Care is empty without the seed.** The redesign ships no persistent seed data; with the in-memory DB (no `MONGODB_URI`) the facility list starts empty, so Find Care shows nothing and nothing is bookable. Run `node scripts/seed-demo.mjs` after the API boots (8 Seoul clinics + 11 doctors, covering every specialty the MA Agent suggests). Re-run after each API restart unless `MONGODB_URI` is set.

### Feature checklist — test EVERY item, record pass ✅ or fail ❌ + notes

#### Patient app (http://localhost:5174)
| # | Feature | How to test | Expected |
|---|---|---|---|
| P1 | **Chat works** | Type "I have a headache" → press Enter | AI streams a response within 5s |
| P2 | **Inline mic (tap once)** | Tap 🎤 mic icon in chat bar → speak → pause | Transcript appears in text box, auto-sends to AI |
| P3 | **Voice mode (hands-free)** | Tap 🎧 headphones icon | Full-screen voice opens, starts listening automatically, no tap needed |
| P4 | **Voice auto-submit** | In voice mode, speak a sentence then stop | AI responds within ~5s without you pressing anything |
| P5 | **Voice loop** | After AI speaks in voice mode | Listening restarts automatically |
| P6 | **Image upload** | Tap 📷 image icon → upload a photo | AI returns a structured medical analysis |
| P7 | **Find Care loads** | Tap Find Care tab | List of hospitals/clinics appears (15 Uzbekistan facilities) |
| P8 | **Book appointment** | In Find Care → tap a doctor → pick date+slot → confirm | Success toast + appointment appears in Records |
| P9 | **Connect to Care CTA** | Chat for 3+ turns about symptoms | "Find Care →" card appears below AI message |
| P10 | **Records / History** | Tap Records tab | Past conversations listed; tap to resume |
| P11 | **Light mode** | Settings → Theme toggle | Page switches to light background |
| P12 | **Language change** | Settings → Language → pick Uzbek → go to Chat | AI responds in Uzbek when you write in Uzbek |

#### Clinic app (http://localhost:5173)
| # | Feature | How to test | Expected |
|---|---|---|---|
| C1 | **Login** | Open → login as `doctor` (any name) | Lands on dashboard |
| C2 | **Patients queue** | Navigate to Patients | List of referrals with urgency badges |
| C3 | **Confirm appointment** | Click Confirm on a referral | Status changes to Confirmed (green) |
| C4 | **Interview module** | Navigate to Interview → type symptoms | AI asks structured follow-up questions |
| C5 | **Symptoms module** | Navigate to Symptoms → enter symptoms | Returns ranked differential with % bars |
| C6 | **Reports module** | Navigate to Reports → upload image | Returns structured image analysis |
| C7 | **Triage module** | Navigate to Triage → fill vitals | Returns Manchester triage level (RED/ORANGE/etc.) |
| C8 | **Pharmacist login** | Login as `pharmacist` | Sees Dashboard + Prescriptions nav only |
| C9 | **Light mode** | Settings → Theme toggle | Switches to light mode |

#### Full loop test (most important)
| # | Test | Steps |
|---|---|---|
| FL1 | **Patient books → clinic sees** | 1. Patient app: chat 3+ turns → Find Care → book appointment. 2. Clinic app: Patients tab → verify referral appears with summary |

### Reporting bugs
Copy the template from [`docs/qa/issues.md`](./docs/qa/issues.md) and add your finding there. Set severity:
- **SEV-1** — app crashes / feature completely broken (Ismail fixes)
- **SEV-2** — feature partially broken, workaround exists (Ismail or Otabek)
- **SEV-3** — minor glitch, cosmetic (Otabek or Sobirov)
- **SEV-4** — typo, pixel misalignment (Sobirov)

### Git workflow after fixes
```bash
git checkout -b fix/your-fix-name
# make your fix
pnpm typecheck          # must pass
pnpm build              # must pass
git add <files>
git -c user.name="ismoiljon1101" -c user.email="ismoiljonedu@gmail.com" commit -m "fix: description"
git push origin fix/your-fix-name
# open PR → develop
```

---

## 3 · Per-Engineer Current Sprint (May 28 → Jun 9)

### Ismail
1. ✅ Switch LLM defaults to Qwen 3.x
2. ✅ Lead Pareto research + unblock Temirlan
3. ✅ Node ↔ Python image-ml HTTP contract
4. ✅ Wire vision.ts → services/image-ml
5. ✅ **Full architecture redesign** (2026-06-04) — MVC services, agent booking, Korea defaults, phone identity, schema cleanup
6. ✅ `pnpm typecheck` clean across all 5 workspaces
7. 📋 **Frontend design pass** — use `/frontend-design` on Chat, FindCare, Clinic Patients
8. 📋 **End-to-end verification** — full loop test before v0.1.0
9. 📋 Tag `v0.1.0` when DoD green

### Mirsaid
1. OpenRouter credit ≥ $20 in account.
2. MongoDB Atlas free cluster → hand `MONGODB_URI` to Ismail (Signal / 1Password, never email).
3. LiveKit Cloud account → hand `LIVEKIT_*` creds.
4. Full QA pass per [§6 Acceptance Criteria](#6--acceptance-criteria-for-v010). File every issue to [`docs/qa/issues.md`](./docs/qa/issues.md) using the template in [`docs/team/mirsaid.md`](./docs/team/mirsaid.md).
5. Record 90s backup demo video. Link in this file when done.

### Temirlan
**Research complete — unblocked.** Read [`research/00-overview.md`](./research/00-overview.md) first (executive summary) then [`research/Medical ML for Rural Settings.md`](./research/Medical%20ML%20for%20Rural%20Settings.md) (full report with citations).

**Phase 1 — Malaria (ship first, MIT license, fastest path)**
1. `pip install -r services/image-ml/requirements.txt && uvicorn main:app --reload --port 5001`. Verify `/healthz`.
2. Download YOLOv8n-Malaria weights from the NIH Thin Blood Smear repo (paper DOI in research overview). Add `services/image-ml/download_weights.sh` — never commit weights.
3. Wire `/analyze` with `hint=microscopy` (or auto-detect) → return `{ image_type: "malaria_smear", findings: [{label, confidence}], model_used: "yolov8n-malaria" }`.
4. Eval harness: `services/image-ml/eval/malaria.py` — accuracy / sensitivity / specificity on held-out NIH test split. Commit `eval/results.md`.
5. Pair with Ismail on Node↔Python integration (`apps/api/src/services/vision.ts` merge logic).

**Phase 2 — Pneumonia (TorchXRayVision)**
6. Integrate TorchXRayVision DenseNet121-all model. Apache 2.0 ✅. Wire `hint=xray` path.
7. **Coordinate with Otabek** on the X-ray alignment UI — research says photographed X-rays need parallax-correction overlay, otherwise accuracy drops 15–25%.

**Phase 3 — Skin lesions (HAM10000, non-commercial demo only)**
8. YOLOv8n-cls + HAM10000. CC BY-NC ⚠️ — document clearly that this is humanitarian-program / pilot only.
9. Add CLAHE preprocessing step (boosts accuracy from 86.2% → 91.9% per research).

**Skip for v0.1**
- ResNet50-DR (retinopathy) — non-commercial, defer
- MobileNetV2-ScabAI (scabies) — dataset too small, defer

### Otabek
**Done:**
1. ✅ ~~Image thumbnail in `apps/patient/src/pages/Chat.tsx`~~ — `11c818c`
2. ✅ ~~Dismiss-X on the Connect-to-Care CTA card.~~ — `6d207fb`
3. ✅ ~~30s polling on `apps/clinic/src/pages/Patients.tsx`~~ — `5fd2044` (+ visibility-change refresh + sync indicator)
4. ✅ ~~Image-quality capture interface~~ — `imageQuality.ts` + `ImageCaptureFlow.tsx` (blur/glare/brightness gate, modality overlays, 3-item checklist, retake flow)
5. ✅ ~~Care discovery — map integration~~ — Tier 1 enrolled + Tier 2 Google Maps fallback + navigation deep links in `FindCare.tsx`
7. ✅ ~~Loading / empty / error states pass~~ — Dashboard skeleton + error state added; Patients/Prescriptions already had them
8. ✅ ~~Lighthouse PWA ≥ 90~~ — Split icon purposes, add patient `public/` icons, Apple meta tags, font caching

**Next:**
6. LLM-switch smoke test — after Ismail switches to Qwen 3.6 Plus, walk Chat / Symptoms / Reports / Triage in both portals. Note language quality on Uzbek + Hindi.

### Sobirov
1. Take all screenshots listed in [§5 Demo Assets](#5--demo-assets).
2. ✅ ~~Spellcheck pass on `README.md`~~ — model names corrected, consistent with `llm.ts`
3. ✅ ~~Add `aria-label` to every icon-only button~~ — VoiceMode, FindCare, Reports, Symptoms, VoiceButton done
4. Pull SEV-3 / SEV-4 bugs from [`docs/qa/issues.md`](./docs/qa/issues.md) once Mirsaid starts filing. Use the guided workflow in [`docs/team/sobirov.md`](./docs/team/sobirov.md).

---

## 3.5 · Epic: Care Discovery & Map Integration

> **Goal:** Patient always finds *somewhere* to go. Tiered: our network first, public maps as fallback, deep navigation links always.
> **Why:** Closes the loop even when no enrolled clinic is nearby. Network effect — every map listing is a clinic we can recruit.

### Tiered discovery model

```
Patient needs care (from MA Agent CTA or Find Care tab)
   │
   ├─ TIER 1 · Enrolled clinics (our DB)        ← EASY, mostly done
   │    GET /api/clinics → registered clinics + their doctors + specialties + availability
   │    → in-app booking with the right doctor → referral lands in clinic Patients queue
   │
   ├─ TIER 2 · Public map fallback (if no/few enrolled nearby)   ← MEDIUM
   │    Google Maps Places "nearby search" (type=hospital|doctor|pharmacy)
   │    Naver Maps Places (Korea region)
   │    → list name, distance, rating, hours, phone
   │    → one-tap deep link to Google/Naver navigation
   │
   └─ TIER 3 · Reverse matching (clinic side)    ← MEDIUM
        Clinic sees nearby patients whose MA Agent specialty/urgency matches what the clinic offers
        → geo + specialty filter on the referral queue
```

### Difficulty & achievability

| Tier | Difficulty | Achievable v0.1? | Notes |
|---|---|---|---|
| 1 · Enrolled clinics + booking | 🟢 Easy | ✅ Yes — foundation already shipped (`searchClinics`, `Referral`, Patients queue) | Need: Doctor model + per-doctor specialty/availability; real clinic registration |
| 1b · Book with the *correct doctor* | 🟡 Medium | ◑ Partial | Add `Doctor` sub-model + availability slots; booking picks doctor by specialty |
| 2 · Google Maps Places fallback | 🟡 Medium | ✅ Yes (with API key) | Places Nearby Search API; ~$17/1k req — Mirsaid procures key + sets quota cap |
| 2 · Naver Maps (Korea) | 🟡 Medium | ◑ Region-gated | Separate Naver Cloud API; only load when region=KR. Pluggable provider interface. |
| 2 · One-tap navigation deep links | 🟢 Easy | ✅ Yes | `https://www.google.com/maps/dir/?api=1&destination=…` and `nmap://route/...` — no key needed |
| 3 · Clinic-side reverse matching | 🟡 Medium | ◑ Partial | Geo + specialty filter on existing referral queue; needs clinic geo + offered-specialty fields |

**Verdict:** Tier 1 + Tier 2 navigation deep links are demo-ready now. Places API fallback needs a key (Mirsaid). Per-doctor booking + reverse matching are reach goals for v0.1, solid for v0.2.

### Tasks by owner

**Ismail (architecture — soft gate, his own files):**
- ✅ `Doctor` model in `packages/db/src/models/` (name, specialty[], clinicId, availability slots)
- ✅ Extend `Clinic` model: `lat`, `lng`, `offeredSpecialties[]`, `enrolled: boolean`
- ✅ `GET /api/clinics/:id/doctors` endpoint
- ✅ **Map provider proxy** `apps/api/src/routes/maps.ts` — server-side Places call, API key never reaches client
- ✅ Schema additions in `packages/shared/src/schemas.ts` (ClinicResult + lat/lng/doctors, MapPlace)

**Otabek (frontend):**
- ✅ `FindCare.tsx`: Tier 1 enrolled clinics first, Tier 2 map results below with "Navigate" deep links
- ✅ Doctor picker in booking sheet (filter by MA Agent specialty)
- ✅ One-tap navigation deep links (Google + Naver, pick by locale)
- ✅ ~~Map view toggle (list ↔ embedded map)~~ — done in `be0a07e` (Otabek, OpenStreetMap iframe, no API key needed)

**Mirsaid (ops):**
- [ ] Procure **Google Maps Platform API key** (Places + Directions), set a **hard quota cap** to protect budget. Hand to Ismail.
- [ ] Procure **Naver Cloud Maps** key if Korea is in scope. Confirm with Ismail whether KR is a target market.
- [ ] Document key setup in `.env.example` (Ismail merges the contract change).

**Sobirov (guided):**
- ✅ ~~Seed 5–10 realistic demo clinics with lat/lng + doctors for the demo script.~~ — done in `apps/api/src/routes/facilities.ts` (15 real Uzbekistan facilities + 30 doctors, OSM-verified coords)

### Open questions for Ismail
- Is **Korea (Naver)** actually a target market, or is Google Maps enough for v0.1? (Naver only makes sense if KR users exist.)
- Per-doctor booking in v0.1 or defer to v0.2? (Adds Doctor model + availability complexity.)
- Pharmacy discovery — same tiered model reuses this epic (Places `type=pharmacy`).

---

## 4 · Endpoint Verification Checklist

For each endpoint: 2xx on happy path, structured error on bad input, < 8s with the default model.

- [ ] `GET  /api/health` (rag.size = 31, db.connected, providers.openrouter)
- [ ] `POST /api/chat` (`{ message }`)
- [ ] `POST /api/chat/stream` (SSE tokens + meta with citations)
- [ ] `GET  /api/chat/session/:id`
- [ ] `POST /api/symptoms`
- [ ] `POST /api/triage`
- [ ] `POST /api/reports/analyze` (multipart image)
- [ ] `POST /api/transcribe` (needs `OPENAI_API_KEY`)
- [ ] `POST /api/voice/token` (LiveKit)
- [ ] `GET  /api/voice/status`
- [ ] `GET  /api/clinics?lat=&lng=&specialty=` (Haversine sort)
- [ ] `POST /api/clinics/referrals` (patient booking from Find Care)
- [ ] `GET  /api/clinics/referrals` (clinic queue)
- [ ] `PATCH /api/clinics/referrals/:id` (confirm/cancel)
- [ ] `GET  http://localhost:5001/healthz` (Python sidecar — when `IMAGE_ML_URL` set)
- [ ] `POST http://localhost:5001/analyze` (returns stub `skipped: true` for now)

---

## 5 · Demo Assets

| File | Owner | Status |
|---|---|---|
| `docs/screenshots/01-patient-chat.png` (MA Agent mid-conversation w/ citations) | Sobirov | 📋 |
| `docs/screenshots/02-patient-voice.png` (immersive voice mode) | Sobirov | 📋 |
| `docs/screenshots/03-patient-image-upload.png` (image analysis result inline) | Sobirov | 📋 |
| `docs/screenshots/04-patient-connect-cta.png` (Find Care CTA after clinical snapshot) | Sobirov | 📋 |
| `docs/screenshots/05-patient-find-care.png` (clinic list + booking sheet) | Sobirov | 📋 |
| `docs/screenshots/06-clinic-patients-queue.png` (incoming referrals w/ urgency badges) | Sobirov | 📋 |
| `docs/screenshots/07-clinic-interview.png` (provider chat + RAG chips) | Sobirov | 📋 |
| `docs/screenshots/08-clinic-symptoms.png` (ranked differentials) | Sobirov | 📋 |
| `docs/DEMO.md` (5-min walkthrough script — both portals, full loop) | Ismail + Sobirov | ✅ |
| `docs/demo-backup.mp4` (90s screen capture fallback) | Mirsaid | 📋 |

---

## 6 · Acceptance Criteria for v0.1.0 (Definition of Done)

### End-to-end loop (the headline)
- [ ] Patient opens MA Agent chat, describes symptoms over ≥ 3 turns
- [ ] After clinical snapshot, "Find Care →" CTA appears with detected specialty + urgency
- [ ] Patient taps CTA → lands on Find Care with specialty pre-filtered + GPS-sorted clinics
- [ ] Patient books an appointment via the bottom sheet → success state appears
- [ ] Clinic portal `/patients` shows the referral with urgency badge, MA Agent summary, contact info
- [ ] Clinician taps "Confirm Appointment" → status updates to confirmed
- [ ] Patient gets a confirmation (post-MVP: SMS/push; v0.1: status visible in Records if logged in)

### Patient app
- [ ] Chat streams MA Agent responses with citation chips
- [ ] Voice mode (LiveKit OR Web Speech fallback) transcribes correctly
- [ ] Image upload in chat → analysis result inline (markdown formatted)
- [ ] Records page shows chat history; resume restores conversation
- [ ] Settings: language picker, font size, voice auto-play toggle
- [ ] MA Agent refuses to reveal model/provider when asked

### Clinic app
- [ ] All 4 original modules functional (Interview, Symptoms, Reports, Triage)
- [ ] New Patients page shows queue with urgency colors + filter tabs
- [ ] Confirm / Decline / Reopen actions persist (MongoDB or in-memory)

### Cross-cutting
- [ ] `pnpm install && pnpm dev` works on clean clone (Windows + macOS)
- [ ] `pnpm typecheck` passes all workspaces
- [ ] PWA Lighthouse score ≥ 90 for both portals
- [ ] Multilingual smoke test: English, Spanish, Uzbek, Hindi → response language matches input
- [ ] MongoDB persistence verified; in-memory fallback also verified (with `MONGODB_URI` unset)
- [ ] Python image-ml `/healthz` reachable; Node gracefully degrades when sidecar down
- [ ] All `docs/team/` files present; CLAUDE.md identity check works (manual test)
- [ ] No `.env` committed; no Co-Authored-By lines; all commits as `ismoiljon1101`

---

## 7 · Risk Log

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Model returns non-JSON for `/symptoms` `/triage` `/reports` | Medium | `safeParseJson` regex repair + best-effort Zod (in place) |
| 2 | Vision model refuses ("I cannot analyze medical images") | Medium | Sonnet 4.5 vision usually compliant. Specialist sidecar gives a second read. Prompt frames as copilot. |
| 3 | OpenRouter rate-limit / outage during demo | Medium | Pre-warmed backup key. Cache 5 demo responses. Mirsaid keeps credit topped up. |
| 4 | Python sidecar startup adds setup friction | Medium | `IMAGE_ML_URL` unset → Node skips it entirely. Demo works without Python. |
| 5 | HAM10000 license (CC BY-NC) blocks commercial use | Low (for demo) | Document clearly. Post-MVP: switch to permissively-licensed weights or re-train. |
| 6 | LiveKit creds missing → voice mode broken | Low | Web Speech API fallback already wired. |
| 7 | Multilingual quality drops for low-resource languages | Medium | Disclose honestly in README. Demo with high-quality languages first. |
| 8 | Live demo network fails | Medium | Mirsaid's 90s backup video in `docs/demo-backup.mp4`. |
| 9 | Sobirov breaks something architectural | Low | CLAUDE.md soft gate refuses + asks "did Ismail sign off?". Sobirov's `docs/team/` scope is tight. |
| 10 | Agent ignores identity check, treats everyone as Ismail | Low | CLAUDE.md §5 says "do not edit, write, commit, or run network commands until role confirmed". |

---

## 8 · Bugs / Issues

All bugs live in [`docs/qa/issues.md`](./docs/qa/issues.md). Format and severity scale in [`docs/team/mirsaid.md`](./docs/team/mirsaid.md).

**New dependency (justified):** `qrcode-terminal` (root devDependency, MIT). Dev-only, never shipped. Powers `pnpm qr` — prints scannable QR codes for the current WiFi IP so students open the apps on their phones without typing. Both Vite servers run `host: true`, so they follow whatever IP the WiFi assigns; re-running `pnpm qr` after a network change is the only step.

| Severity | Owner pool |
|---|---|
| SEV-1 (blocker) | Ismail |
| SEV-2 (major) | Ismail or Otabek |
| SEV-3 (minor) | Otabek or Sobirov |
| SEV-4 (nit) | Sobirov |

---

## 9 · Deferred (post-competition, on purpose)

- HIPAA / SOC 2 compliance review and DPA workflow
- Real EHR integration (HL7 / FHIR)
- Production vector DB (pgvector / Qdrant) with curated corpus ≥ 5k docs
- Auth, RBAC, multi-tenant deployment
- Fine-tuned medical model (Med-PaLM-style)
- Native mobile (PWA is sufficient for v0.1)
- Audit log + clinician override workflow + signed-off recommendations
- Text-to-speech read-back of MA Agent answers
- DICOM upload, PDF lab parsing
- Cost dashboard per session
- E2E test suite (Playwright) — smoke testing only for now
- GPU inference for image-ml sidecar (currently CPU-only)
- SMS / push notification when clinic confirms referral

---

## 10 · Working Agreement

- **pnpm only.** Never `npm install`.
- **TypeScript strict / Python typed.** No `any` (TS) / `Any` (Py) without one-line reason.
- **Schemas before code.** Cross-boundary changes start in `packages/shared/src/schemas.ts`.
- **No new dependencies** without a justification in commit message.
- **No `.env` ever committed.**
- **Conventional Commits.** `feat`, `fix`, `docs`, `chore`, `polish`.
- **Branching.** Feature branch → PR into `develop` → squash-merge. Tag `v0.1.0` from `develop`.
- **Don't refactor what works.** Two weeks. Add features, fix bugs, polish — do not restructure.
- **Identity check first.** Agent asks who you are before any edit. Don't bypass.

---

## 11 · Quick Reference

- **Agent rules:** [`CLAUDE.md`](./CLAUDE.md) · [`AGENTS.md`](./AGENTS.md) · [`.cursorrules`](./.cursorrules)
- **Team files:** [`docs/team/`](./docs/team/)
- **QA inbox:** [`docs/qa/issues.md`](./docs/qa/issues.md)
- **Image pipeline:** [`docs/architecture/image-pipeline.md`](./docs/architecture/image-pipeline.md)
- **API contracts:** `packages/shared/src/schemas.ts`
- **System prompts:** `packages/shared/src/prompts.ts`
- **Seed knowledge:** `packages/shared/src/medical-knowledge.ts`
- **Patient API client:** `apps/patient/src/lib/api.ts`
- **Clinic API client:** `apps/clinic/src/lib/api.ts`
- **Env contract:** `.env.example`
- **Why decisions:** [`README.md`](./README.md)

---

## 12 · Code Audit — full-stack pass (2026-06-12, Ismail)

> Autonomous audit of the whole flow: patient chat → booking → clinic queue, plus backend services, schemas, and UI/UX. `pnpm typecheck` is **clean** across all 5 workspaces (no mechanical type errors). Findings below are logic / UX / data-integrity issues found by reading the source.

### 🔴 Bugs being fixed this pass

| # | Severity | Area | Finding | Fix | Status |
|---|---|---|---|---|---|
| A1 | SEV-2 | patient/api | **Booking marker leak on resume.** Server stores the assistant message with the raw `<<BOOK:{…}>>` marker (`chat.ts` appendMessage + Interview push). On `GET /chat/session/:id` resume, `Chat.tsx` renders it verbatim → the hidden booking marker shows to the patient. Live stream strips it, resume does not. | Strip the marker before persisting to session + Interview (server side, in both `/` and `/stream`). | ✅ Fixed |
| A2 | SEV-2 | patient/api | **UTC date slip in the booking date pickers.** `BookingFlow.upcomingDates()`, `FindCare.getNextDays()`, and `facility.service.findNextAvailableSlot()` built dates with `toISOString().slice(0,10)` (UTC). In KST (UTC+9) the evening rolls the date back a day — the visible label (local) and the value (UTC) disagree, the Sunday-skip check runs on the wrong day, and slots are fetched for the wrong date. `getUpcomingSlots` already did this correctly (local format). | Use a local `YYYY-MM-DD` formatter everywhere date strings are generated (all three sites). | ✅ Fixed |
| A5 | SEV-3 | patient | **No-phone booking 500s.** `FindCare.handleBook` only required a name; with an empty phone the API rejects the appointment (no `patientId`) and the raw Mongoose error surfaced. | Guard for a phone number up front with a friendly message (matches `BookingFlow`'s disabled state). | ✅ Fixed |
| A3 | SEV-2 | api/db | **Slot double-booking possible in DB mode.** `TimeSlot` has no unique index on `(doctorId,date,startTime)`, and `book()`'s in-memory `inMemoryBookedSlots` gate is never populated when `dbReady()` — so two concurrent confirms of the same slot both create a TimeSlot + Appointment. Comment claims "enforced by DB uniqueness" but no such constraint exists. | Pre-create check in the DB path (throw `SLOT_TAKEN` → 409) + unique index on `TimeSlot(doctorId,date,startTime)`. | ✅ Fixed |
| A4 | SEV-3 | patient | **Wrong emergency number for Korea.** Chat emergency pill dials `tel:112` (police) labeled "112 / 911 / 999". Korea medical/ambulance is **119**. Product is Korea-first. | Dial `119`, relabel "119 (KR) · 911 (US) · 999 (UK)". | ✅ Fixed |

### 🟡 Known gaps / cleanup (not fixed this pass — flagged for decision)

| # | Severity | Area | Finding | Recommendation |
|---|---|---|---|---|
| B1 | SEV-3 | api | **Dead conversational-proposal code path.** `agent-booking.service.findBestOption` + the `proposals` Map + `POST /api/appointments/confirm` + client `confirmAgentBooking` + the `agentProposal` / `booking_proposal` UI in `Chat.tsx` are all dead — chat booking now goes through the `<<BOOK>>` marker → `POST /api/appointments`. `/confirm` would 400 (proposals never populated). | Remove in a dedicated cleanup PR (touches working files; out of scope for a bug pass per the no-refactor rule). |
| B2 | ~~SEV-4~~ ✅ | api | ~~**`POST /api/chat` (non-stream) ignores `lat`/`lng`**~~ **Fixed (2026-06-13):** non-stream route now parses + passes lat/lng to `getBookableDoctors` for parity with `/stream`. | Done. |
| B3 | ~~SEV-3~~ ✅ | patient | ~~**`autoBook` writes blank `facilityName`/`doctorName`**~~ **Fixed via C5 (2026-06-13):** the `<<BOOK>>` marker now carries `doctorName`/`facilityName`, so the local store is populated immediately (no transient blank). | Done. |
| B4 | ~~SEV-3~~ ✅ | api | ~~**In-memory (no-DB) queue/records aren't populated.**~~ **Fixed (2026-06-13):** `getQueue`/`getPatientAppointments` now hydrate doctor/facility/patient names from the in-memory stores, mirroring the DB `.populate()` shape — clinic queue & records show names even without Mongo. | Done. |
| B5 | ~~DOC~~ ✅ | docs | ~~**Vision is now sidecar-only, not "hybrid".**~~ **Fixed (2026-06-13):** README, `docs/architecture/image-pipeline.md`, and deck slide 9 rewritten to describe the sidecar-only pipeline (image read locally, never sent to a cloud LLM; LLM narrates findings; graceful text-only fallback). | Done. |
| B6 | ~~DOC~~ ✅ | api | ~~**Image analysis does NOT degrade gracefully.** `analyzeImageFull` threw **503** when `IMAGE_ML_URL` was missing/unreachable — image upload hard-failed (ARM64 demo risk).~~ **Fixed (2026-06-13):** sidecar unset/unreachable now degrades to the text-only guidance path instead of 503. The image is still NEVER sent to a cloud LLM — only generic text guidance is returned, preserving the no-cloud-vision rule. | Done. |

> Update the Status column as fixes land. B1–B4 are intentionally deferred (cleanup / no-DB-only) — pick up in a follow-up once the demo is locked.

---

## 12.5 · Code Audit — pass 2 (2026-06-13, Ismail)

> Second full-stack pass: workflow, UI/UX, frontend, backend. `pnpm typecheck` re-verified **clean** on all 5 workspaces. A1–A5 fixes confirmed in source. New findings below (C-series), ordered by demo impact.

### 🔴 New bugs

| # | Severity | Area | Finding | Fix | Status |
|---|---|---|---|---|---|
| C1 | SEV-2 | api/db | **Booking with an unknown phone 500s AND leaks an orphaned booked slot.** `POST /api/appointments` looks up `getIdByPhone`; any phone without a Patient record (user edits phone in the FindCare form, or Welcome's `createPatient` silently failed offline — it swallows the error and proceeds local-only) → `patientId` undefined. `book()` creates the `TimeSlot` (isBooked:true) FIRST, then `Appointment.create` throws Mongoose validation (`patientId` required) → raw 500 to the patient **and the slot stays blocked forever** (no rollback). | Server-side `findOrCreate` patient from phone (+name when provided); delete the TimeSlot if Appointment.create fails (or create Appointment first). | ✅ Fixed |
| C2 | SEV-2 | patient | **FindCare booking form fields are decorative.** The client `bookAppointment` normalizer drops `patientName`/`patientEmail`/`patientAge`/`patientSex` — `BookAppointmentSchema` has no such fields. Everything a new user types in "Your details" is silently discarded; the doctor never sees it. | Extend schema + server to accept name/age/sex (feed C1's findOrCreate), or remove the dead fields from the form. | ✅ Fixed |
| C3 | SEV-2 | patient | **Voice mode speaks the `<<BOOK>>` marker aloud and never books.** `VoiceMode.tsx` doesn't strip/parse the booking marker: if the agent books during a voice conversation, the raw JSON marker shows in the transcript bubble, gets read by TTS, and no appointment is created. Conversational booking — the headline feature — is broken in voice. | Reuse `parseBookingMarker` before display/TTS; either auto-book like Chat or have the agent's voice path defer booking to text. | ✅ Fixed |
| C4 | SEV-2 | patient | **My Records → Appointments never syncs with the server.** Tab renders only the local zustand snapshot, frozen at `pending`. When the clinic confirms, the patient's Records still says pending forever (FindCare's "My Appointments" fetches live status; Records doesn't). Breaks the DoD line "status visible in Records" — the closing-the-loop demo beat. Compounds with C5/B3 blank names. | Fetch `getMyAppointments(phone)` in MyRecords and merge/replace local entries. | ✅ Fixed |
| C5 | SEV-3 | shared/patient | **BOOK marker contract omits `doctorName` but Chat reads it.** `prompts.ts` marker JSON = doctorId/facilityId/specialty/date/time/reason; `Chat.tsx` reads `payload.doctorName` → undefined → fallback booking card renders with an empty title, and the local appointment stores `doctorName: undefined` (root cause of B3's blank Records entries). | Add `doctorName`/`facilityName` to the marker contract, or look the doctor up by id client-side. | ✅ Fixed |
| C6 | SEV-3 | api/patient | **LLM stream failure = silent empty bubble + polluted session.** `/chat/stream` emits `event: error`, but `Chat.tsx` just breaks the loop — patient sees an empty assistant bubble with no message (VoiceMode handles this case; Chat doesn't). Server then persists the empty assistant message to the session/Interview, so resumes show blank turns. | Surface the error event in Chat like VoiceMode does; skip persisting empty assistant messages server-side. | ✅ Fixed |
| C7 | SEV-3 | api | **Session-store race after API restart.** `sessions.getSession` is sync; on a miss it fires an async Mongo load and returns null → chat route `ensureSession` creates an EMPTY session → the first message after a restart is answered with zero conversation context, and the late async `store.set` can clobber messages appended meanwhile. | Make the chat routes await an async `getSession`, or merge instead of overwrite in the async loader. | ✅ Fixed |
| C8 | SEV-3 | patient | **Chat ↔ Voice session desync.** Voice turns append to the shared server session, but returning from `/voice` Chat doesn't reload — voice exchanges are invisible in the chat transcript. If voice starts without a session, its new sessionId is dropped on exit; the next typed message starts a fresh session and the voice context is lost. | Pass the live sessionId back on exit (`navigate('/?s=' + id)`) and reload messages on focus/return. | ✅ Fixed |
| C9 | SEV-3 | patient/seed | **Specialty vocabulary mismatch across chips / seeds / detectors.** FindCare chips `Psychiatry`, `Emergency Medicine`, `Family Medicine`, `ENT`, `Oncology` never match seeded specialties (`Mental Health`, `Emergency`, …) → those chips always hit the "no specialists" fallback. Seeds also lack OB-GYN / Gastroenterology / Orthopedics, which the backend `detectSpecialty` emits. | Align the three vocabularies (chips, seed-demo.mjs, chat.ts detectSpecialty) on one list. | ✅ Fixed |
| C10 | SEV-3 | patient | **Conversational auto-book hardcodes urgency.** `Chat.tsx autoBook` always sends `urgency: 'see-clinician-soon'`, even when the conversation/triage was urgent → clinic queue under-triages every chat-booked referral. | Carry the detected urgency (ctaSpec/detectUrgency) into the booking. | ✅ Fixed |
| C11 | SEV-4 | patient | Three small leaks/staleness: (a) Chat's object-URL cleanup effect closes over the initial empty `messages` → uploaded-image blob URLs never revoked; (b) session resume doesn't restore `userTurnRef`, so the care CTA needs 3 fresh turns again; (c) FindCare `DAYS` computed at module load → date strip goes stale if the tab lives past midnight. | Track URLs in a ref; restore turn count on resume; compute days on mount. | ✅ Fixed |
| C12 | SEV-4 | api | `PATCH /api/appointments/:id` without `status` writes `status: undefined` — in-memory path corrupts the record (DB path no-ops by luck). | Require/validate `status` before calling `updateStatus`. | ✅ Fixed |
| C13 | SEV-4 | patient | Tier-2 Naver "Navigate" links are `nmap://` deep links → dead click on desktop browsers (fine on phones with the Naver app). | Use the Naver web URL when not on mobile. | ✅ Fixed |
| C14 | NOTE | clinic | Clinic queue is unscoped — `getReferrals()` is called without `facilityId`, so every clinic login sees ALL facilities' appointments. Acceptable for the single-clinic demo; must scope before any multi-clinic pilot. | Pass the logged-in facility id once clinic identity exists. | deferred |
| C15 | SEV-3 | patient | **Image modality picker is decorative.** `ImageCaptureFlow` makes the user choose Skin/X-ray/Eye and shows the matching alignment overlay, but `Chat.handleCaptureConfirm(file, _modality)` discards the modality — it's never sent as `note`/hint to `/reports/analyze`, so the sidecar must guess the image type (research: misrouting costs 15–25% accuracy). | Send the modality as the `note` form field (vision.ts already derives the hint from it). | ✅ Fixed |
| C16 | SEV-3 | patient | **Settings language list omits Korean.** Welcome offers Korean/Japanese/Chinese; the Settings picker uses a different 16-language list with NO Korean or Japanese. A Korea-first user who onboarded in Korean opens Settings → the select can't display their language and one tap silently switches them off it. | Use one shared LANGUAGES list (with Korean) in both screens. | ✅ Fixed |
| C17 | SEV-4 | patient | **"Auto-play AI responses" toggle is dead.** `voiceAutoPlay` is written by Settings but read by no component — Chat never speaks responses. DoD explicitly lists "voice auto-play toggle". | Wire TTS auto-play in Chat (speak on stream end) or remove the toggle. | ✅ Fixed |
| C18 | SEV-4 | patient | **EmergencyCheck mic fails silently.** Permission denied and transcription failure are both swallowed by empty `catch {}` — the mic button appears to do nothing. | Show the same inline error pattern VoiceMode uses. | ✅ Fixed |

### 🟢 Demo readiness (v1.0 professor demo, ~mid-June)

| Check | State |
|---|---|
| `pnpm typecheck` (5 workspaces) | ✅ clean (re-run 2026-06-13) |
| A1–A5 fixes in source | ✅ verified |
| Sidecar weights on disk | ✅ `eye-dr-detect.onnx` (214 MB), `malaria-yolov8s.pt` (6 MB — **§0 status table says "blocked/401" but the weight IS present; update the row or verify it loads**), `skin-convnext-ham10000.pth` (350 MB) |
| Skin path | ⚠️ `main.py` warns the ConvNeXt checkpoint may be a bare state_dict needing an arch wrapper → may still return `skipped:true`. **Verify with a real upload before the demo.** |
| Image upload without sidecar | 🔴 hard-fails 503 (B6) — ARM64 laptop cannot run the sidecar; demo must run it on an x86 box or skip the image beat |
| LAN/HTTPS phone access | ✅ Vite proxy means no CORS issue; **plain HTTP LAN blocks mic/camera/GPS (secure context)** — use the cloudflare tunnel (`scripts/tunnel.mjs`) for any phone demo of voice/image/GPS |
| Known demo killers | unchanged: missing `OPENROUTER_API_KEY` (silent AI failure) and unseeded Find Care (`node scripts/seed-demo.mjs` after every in-memory API restart) |
| Closing-the-loop beat | ⚠️ works via FindCare "My Appointments" (live status); **do NOT show My Records → Appointments for the confirm beat until C4 is fixed** (status frozen at pending) |

**Suggested fix order before the demo:** C3 (voice booking) → C4 (records sync) → C1+C2 (booking robustness) → C5 → C9 → C6. C7/C8/C10–C13 are post-demo unless time allows.
