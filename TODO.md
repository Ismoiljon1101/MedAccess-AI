# MedAccess AI — Team Task Tracker

> **Mission:** Ship an AI Doctor Copilot for rural & underserved areas that *closes the loop* — patient gets a structured read AND reaches a real clinic.
>
> **Single source of truth for API contracts:** `packages/shared/src/schemas.ts`.
> **For the *why* behind every decision:** [README.md](./README.md).
> **For who owns what:** [`docs/team/`](./docs/team/) + this file's §2 Team & Ownership.
> **For agent rules:** [`CLAUDE.md`](./CLAUDE.md) (every agent reads this before touching anything).

---

## 0 · Status Dashboard

| Phase | Status |
|---|---|
| Monorepo scaffold + tooling | ✅ Done |
| `packages/shared` (schemas, prompts, 31 RAG docs) | ✅ Done |
| `packages/db` (MongoDB models incl. Referral) | ✅ Done |
| `apps/api` (Express, all routes + voice + clinics + referrals) | ✅ Done |
| `apps/clinic` (provider UI + **Patients queue**) | ✅ Done |
| `apps/patient` (patient PWA, 9 pages, **MA Agent + Find Care booking loop**) | ✅ Done |
| Patient → clinic referral loop (Connect-to-Care CTA → booking → clinic queue) | ✅ Done |
| Per-engineer agent files (`CLAUDE.md` + `docs/team/`) | ✅ Done |
| Python image-ml sidecar (scaffold + contract) | ✅ Scaffold done · specialist models pending |
| **Research folder** (`research/`) — Pareto disease + model + dataset survey | ✅ **Complete** ([`research/00-overview.md`](./research/00-overview.md)) |
| Cheapest LLM switch — Qwen 3.6 Plus (free) | 📋 Todo (Ismail) |
| Patient image-quality guidance modal + checklist | 📋 Todo (Otabek, **research-confirmed REQUIRED, not optional**) |
| Vision model upgrade (Sonnet 4.5) | ❌ **Cancelled** — going free-Chinese instead |
| QA pass across both portals | 🚧 In progress (Mirsaid) |
| Image thumbnails in chat | 📋 Todo (Otabek) |
| Specialist disease models: **YOLOv8n-Malaria** (Phase 1, MIT) | 📋 Todo (Temirlan, **unblocked**) |
| Specialist disease models: **TorchXRayVision** pneumonia (Phase 2) | 📋 Todo (Temirlan + Otabek for alignment UI) |
| Specialist disease models: **YOLOv8n-cls** skin lesions (Phase 3, non-commercial pilot only) | 📋 Todo (Temirlan) |
| PWA Lighthouse audit ≥ 90 | 📋 Todo (Otabek) |
| Screenshots + DEMO.md | 📋 Todo (Sobirov) |
| Tag `v0.1.0` + submit | 📋 Todo (Ismail) |

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
| 3 | Skin lesions | YOLOv8n-cls (HAM10000) | CC BY-NC ⚠️ | Pilot/demo only |
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

## 3 · Per-Engineer Current Sprint (May 28 → Jun 9)

### Ismail
1. **Switch all LLM defaults to cheapest Chinese / free models** — Qwen 3.6 Plus (free during preview) for chat + vision. Update `.env`:
   - `OPENROUTER_CHAT_MODEL=qwen/qwen-3.6-plus` (verify exact OpenRouter slug)
   - `OPENROUTER_FAST_MODEL=qwen/qwen-3.5-flash` ($0.065/$0.26)
   - `OPENROUTER_VISION_MODEL=qwen/qwen-3.6-plus` if vision-capable, else next-cheapest Chinese vision model
2. **Lead Pareto research** — fill in [`docs/research/01-pareto-diseases.md`](./docs/research/01-pareto-diseases.md) and downstream files. This unblocks Temirlan.
3. Define Node ↔ Python image-ml HTTP contract (response shape stable, do not break).
4. Wire `vision.ts` to call `services/image-ml` (feature-flagged by `IMAGE_ML_URL`) — after Temirlan ships first specialist model.
5. Pair with Temirlan for first session on the Python sidecar — both must understand it.
6. Review every PR touching `apps/api/`, `packages/shared/`, `packages/db/`.
7. `pnpm typecheck` clean on all workspaces.
8. Tag `v0.1.0` when DoD (§6) green.

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

**Next:**
4. **Image-quality capture interface** in `apps/patient/src/pages/Chat.tsx` (**research-confirmed REQUIRED** — specialist models lose 15–25% accuracy without it):
   - **Alignment overlay per modality** — different on-screen template for skin lesion vs X-ray vs fundus (research file `06-image-quality-ux-template.md`)
   - **Client-side ambient quality gate** — variance-of-Laplacian blur check + brightness histogram check + glare detection. Block submit if image fails; show specific reason ("too blurry — hold still", "too dark — find better light").
   - **Pre-upload guidance modal** — 4 do's / 3 don'ts (lighting / framing / focus / no other body parts)
   - **Post-capture checklist** — preview + 3 confirmations + Retake button
   - Coordinate with Temirlan on Phase 2 — X-ray photographs need parallax-correction overlay (camera parallel to lightbox).
5. **Care discovery — map integration** (see §3.5 Care Discovery epic): in-network clinics first, then Google Maps / Naver Places fallback list + one-tap navigation deep links.
6. LLM-switch smoke test — after Ismail switches to Qwen 3.6 Plus, walk Chat / Symptoms / Reports / Triage in both portals. Note language quality on Uzbek + Hindi.
7. Loading / empty / error states pass across both portals.
8. Lighthouse PWA ≥ 90 on both.

### Sobirov
1. Take all screenshots listed in [§5 Demo Assets](#5--demo-assets).
2. Spellcheck pass on `README.md` (open PR, tag Ismail).
3. Add `aria-label` to every icon-only button (one PR per page).
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
- [ ] `Doctor` model in `packages/db/src/models/` (name, specialty[], clinicId, availability slots)
- [ ] Extend `Clinic` model: `lat`, `lng`, `offeredSpecialties[]`, `enrolled: boolean`
- [ ] `GET /api/clinics/:id/doctors` endpoint
- [ ] **Map provider proxy** `apps/api/src/routes/maps.ts` — server-side Places call so the API key never reaches the client. Pluggable: `google` | `naver` by region.
- [ ] Schema additions in `packages/shared/src/schemas.ts` (ClinicResult + lat/lng/doctors, MapPlace)

**Otabek (frontend):**
- [ ] `FindCare.tsx`: render Tier 1 enrolled clinics first (badge "In-network · book here"), Tier 2 map results below ("Navigate")
- [ ] Doctor picker in booking sheet (filter by MA Agent specialty)
- [ ] One-tap navigation deep links (Google + Naver, pick by locale)
- [ ] Map view toggle (list ↔ embedded map) — optional polish

**Mirsaid (ops):**
- [ ] Procure **Google Maps Platform API key** (Places + Directions), set a **hard quota cap** to protect budget. Hand to Ismail.
- [ ] Procure **Naver Cloud Maps** key if Korea is in scope. Confirm with Ismail whether KR is a target market.
- [ ] Document key setup in `.env.example` (Ismail merges the contract change).

**Sobirov (guided):**
- [ ] Seed 5–10 realistic demo clinics with lat/lng + doctors for the demo script.

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
| `docs/DEMO.md` (5-min walkthrough script — both portals, full loop) | Ismail + Sobirov | 📋 |
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
