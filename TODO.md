# MedAccess AI — Team Task Tracker

> **Mission:** Ship a polished, demo-ready MVP of an AI Doctor Copilot for rural
> & underserved areas in **14 days**.
>
> **Timeline:** 2026-05-26 → 2026-06-09 (competition deadline).
> **Branch model:** feature branches → `develop` → `main` (after submission).
> **Single source of truth for API contracts:** `packages/shared/src/schemas.ts`.

For the *why* behind every decision below, see [README.md](./README.md).

---

## 0 · Status Dashboard

| Phase | Status |
|---|---|
| Research + architecture + plan approval | ✅ Done |
| Monorepo scaffold + tooling | ✅ Done |
| `packages/shared` (schemas, prompts, knowledge, 31 RAG docs) | ✅ Done |
| `packages/db` (MongoDB + Mongoose models for persistence) | ✅ Done |
| `apps/api` (Express + TS, all routes + voice) | ✅ Done |
| `apps/clinic` (provider UI: interview/symptoms/reports/triage) | ✅ Done |
| `apps/patient` (patient mobile app: chat/voice/emergency/care-finder/records) | ✅ Done |
| Smoke test / typecheck / build | 🚧 In progress |
| PWA verification (Lighthouse + mobile install) | 📋 Todo |
| Screenshots + demo script + README update | 📋 Todo |
| Multilingual testing + final polish | 📋 Todo |
| Tag `v0.1.0` + submit | 📋 Todo |

---

## 1 · Locked Architecture (do not relitigate)

| | |
|---|---|
| Package manager | **pnpm** workspaces only — no `npm install` |
| Language | **TypeScript strict**, every source file |
| Backend | Express + TS, Zod-validated, OpenAI SDK pointed at OpenRouter |
| Databases | **MongoDB** (persistent) via `packages/db` + Mongoose; in-memory session TTL |
| Frontend (Clinic) | Vite + React 18 + TS + Tailwind + PWA + Zustand (provider UI) |
| Frontend (Patient) | Vite + React 18 + TS + Tailwind + PWA + Zustand (mobile patient app) |
| LLM provider | **OpenRouter** (single `OPENROUTER_API_KEY`); model picker in UI |
| Voice (STT) | OpenAI Whisper if `OPENAI_API_KEY` set, else browser Web Speech API + LiveKit for voice mode |
| Voice (TTS) | Web Speech API (browser native) |
| RAG | BM25 keyword similarity over **31 seed clinical docs** (no embeddings) |
| Env file | Single root `.env` (loaded by `apps/api/src/server.ts`) |
| Code style | No emojis in code/comments unless asked; comments only where the *why* is non-obvious |

---

## 2 · Repository Map

```
MedAccess-AI/
├── apps/
│   ├── api/                    ✅ Built
│   │   ├── src/routes/         — chat, symptoms, triage, reports, transcribe, voice
│   │   ├── src/services/       — llm (OpenRouter), vision, transcribe, rag (31 docs)
│   │   ├── src/middleware/     — error, upload (multer)
│   │   └── src/utils/          — sessions (in-memory + TTL)
│   ├── clinic/                 ✅ Built (provider UI, formerly apps/web)
│   │   └── src/pages/          — Home, Interview, Symptoms, Reports, Triage
│   │                              (streaming chat, voice, image analysis, triage)
│   └── patient/                ✅ Built (patient mobile app, 9 pages)
│       └── src/pages/          — Home, Chat, VoiceMode, SymptomCheck,
│                                  EmergencyCheck, FindCare, Reports, History, Settings
│                                  (Lottie avatar, full-screen voice, chat history)
├── packages/
│   ├── shared/                 ✅ Built
│   │   └── src/                — schemas (Zod), prompts, medical-knowledge (31 docs),
│   │                              types, index
│   └── db/                     ✅ Built (MongoDB + Mongoose)
│       └── src/models/         — User, Patient, Clinic, Encounter, Interview,
│                                  SymptomAnalysis, TriageResult, ReportAnalysis,
│                                  Session, AuditLog, Role, Permission, etc.
├── docs/                       🚧 ARCHITECTURE.md, ER_MODEL.md, ER_model.mmd
│                                  📋 screenshots/*.png, DEMO.md
├── .env.example                ✅
├── pnpm-workspace.yaml         ✅
├── tsconfig.base.json          ✅
├── package.json                ✅ (root scripts)
├── README.md                   🚧 Needs update for new architecture
└── TODO.md                     🚧 this file
```

---

## 3 · Completed Work (May 26 → May 28)

### ✅ Foundation & Architecture (Days 1–2)
- [x] Competitive + LLM landscape research
- [x] Plan approved (OpenRouter, PWA, monorepo, TS, pnpm)
- [x] Workspace configuration + TypeScript strict

### ✅ Backend Foundation (Days 3–4)
- [x] `packages/shared` — Zod schemas, system prompts
- [x] `packages/db` — MongoDB + Mongoose models (NEW — teammate work)
- [x] `apps/api` — Express + TS, all routes (chat, symptoms, triage, reports, transcribe, **voice**)
- [x] LLM service — OpenRouter client (streaming, JSON mode, safe parse)
- [x] RAG service — BM25 retrieval over **31 clinical docs** (expanded from 15)
- [x] Vision service — multimodal image analysis
- [x] Voice service — Whisper STT + LiveKit integration (NEW)

### ✅ Clinic App (Days 5–7)
- [x] `apps/clinic` (formerly `apps/web`) — provider dashboard
  - [x] Home page (hero + 4 module cards + differentiators)
  - [x] Interview page (streaming chat + VoiceButton + CitationList)
  - [x] Symptoms page (symptom chips + patient context + differentials)
  - [x] Reports page (drag-drop image upload + vision analysis)
  - [x] Triage page (case textarea + vitals grid + Manchester levels)

### ✅ Patient App (NEW — teammate work)
- [x] `apps/patient` — patient mobile app (9 pages, 2,000+ lines)
  - [x] Home page (onboarding)
  - [x] Chat page (full-screen chat with Lottie avatar)
  - [x] VoiceMode page (immersive voice conversation with LiveKit)
  - [x] SymptomCheck page (guided symptom entry)
  - [x] EmergencyCheck page (RED/ORANGE/YELLOW triage)
  - [x] FindCare page (care provider locator)
  - [x] Reports page (medical image upload + analysis history)
  - [x] History page (chat/session persistence)
  - [x] Settings page (preferences + session management)

### ✅ Documentation (NEW — teammate work)
- [x] `docs/ARCHITECTURE.md` (177 lines — system overview + data flow)
- [x] `docs/ER_MODEL.md` (207 lines — database schema)
- [x] `docs/ER_model.mmd` (Mermaid diagram for ER model)
- [x] `Project_Architecture.mmd` (system architecture diagram)

---

## 4 · Remaining Work — Week 2 (May 29 → Jun 9)

### Day 8 · Smoke test & build verification (🚧 IN PROGRESS)
- [ ] `pnpm install` succeeds on clean clone
- [ ] `pnpm typecheck` passes for all workspaces (`apps/api`, `apps/clinic`, `apps/patient`, `packages/shared`, `packages/db`)
- [ ] `pnpm build` builds all apps + packages without warnings
- [ ] `pnpm dev` starts API on `:4000`, clinic on `:5173`, patient on `:5174`
- [ ] `GET /api/health` returns all flags green (OpenRouter, Whisper, RAG ready)
- [ ] Test both clinic + patient UIs in dev environment

**Owner:** _TBD_  · **ETA:** 1 day  · **Acceptance:** zero build errors, both apps load and API responds

### Day 9 · Endpoint verification + MongoDB connectivity
- [ ] Verify all endpoints in `apps/api/src/routes/` (chat, symptoms, triage, reports, transcribe, voice)
- [ ] Test MongoDB write (save session to `packages/db`)
- [ ] Test MongoDB read (retrieve chat history from patient session)
- [ ] Verify Mongoose models instantiate correctly
- [ ] Confirm voice endpoint integrates with LiveKit (if required)

**Owner:** _TBD_  · **ETA:** 1 day  · **Acceptance:** all endpoints 2xx on happy path, structured errors on bad input

### Day 10 · PWA + multilingual testing
- [ ] Lighthouse PWA audit ≥ 90 for both clinic + patient apps
- [ ] Install clinic on Android Chrome ("Add to Home Screen") — verify splash + icon
- [ ] Install patient on iOS Safari — verify standalone mode
- [ ] Manually test patient chat in: English, Spanish, Uzbek, Hindi
- [ ] Verify model output language mirrors user input (not always English)

**Owner:** _TBD_  · **ETA:** 1 day  · **Acceptance:** PWA score ≥ 90, installs on Android/iOS, multilingual responses correct

### Day 11 · Screenshots + demo script
- [ ] `docs/screenshots/01-clinic-home.png` (provider dashboard)
- [ ] `docs/screenshots/02-clinic-interview.png` (mid-conversation with citations)
- [ ] `docs/screenshots/03-clinic-symptoms.png` (ranked differentials)
- [ ] `docs/screenshots/04-clinic-reports.png` (X-ray analysis)
- [ ] `docs/screenshots/05-clinic-triage.png` (RED case)
- [ ] `docs/screenshots/06-patient-chat.png` (mobile chat with avatar)
- [ ] `docs/screenshots/07-patient-voice.png` (voice mode)
- [ ] `docs/screenshots/08-patient-emergency.png` (emergency triage)
- [ ] `docs/DEMO.md` — exact 5-minute walkthrough (both apps)

**Owner:** _TBD_  · **ETA:** 1 day

### Day 12 · README update + polish
- [ ] Update README.md for new architecture (clinic + patient split, MongoDB)
- [ ] Add screenshots to README
- [ ] Verify all internal links resolve
- [ ] Add MongoDB setup to quickstart (connection string example)
- [ ] Spellcheck pass
- [ ] Add `packages/db` to documentation

**Owner:** _TBD_  · **ETA:** 0.5 days

### Day 13 · UI/UX polish pass
- [ ] Loading states (skeleton loaders, spinners) on all async operations
- [ ] Empty states ("no sessions yet", "no chat history")
- [ ] Error toast/banner messaging surfaces API errors clearly
- [ ] Keyboard shortcuts: Enter submits, Esc closes modals
- [ ] Mobile breakpoint testing (< 640px) — layout responsive
- [ ] Accessibility: focus rings, `aria-label` on icon buttons, voice controls

**Owner:** _TBD_  · **ETA:** 1 day

### Day 14 · Demo rehearsal + final submission
- [ ] Run live demo (clinic interview → symptoms → report + patient chat → voice) end-to-end, timed
- [ ] Backup: cached demo responses in `docs/demo-cache.json` (if network fails)
- [ ] Pre-warmed backup OpenRouter key in `.env.backup`
- [ ] Final commit on `develop`
- [ ] Tag `v0.1.0`
- [ ] Push to GitHub
- [ ] Submit per competition instructions

**Owner:** _Team lead_  · **ETA:** 1 day

---

## 5 · Per-Endpoint Verification Checklist

For each endpoint below, confirm: returns 2xx on happy path, returns structured error on bad input, completes in < 8s with the default model.

- [ ] `GET  /api/health`
- [ ] `POST /api/chat`               (body: `{ message }`)
- [ ] `POST /api/chat/stream`        (SSE tokens)
- [ ] `GET  /api/chat/session/:id`
- [ ] `POST /api/symptoms`           (body: `{ symptoms: [...], patient: {...} }`)
- [ ] `POST /api/triage`             (body: `{ caseSummary, vitals }`)
- [ ] `POST /api/reports/analyze`    (multipart: `image` + optional `note`)
- [ ] `POST /api/transcribe`         (multipart: `audio`, needs `OPENAI_API_KEY`)
- [ ] `GET  /api/transcribe/status`

---

## 6 · Acceptance Criteria for v0.1.0 (Definition of Done)

### Clinic App (Provider Dashboard)
A judge can:
- [ ] Clone repo, run `pnpm install && pnpm dev` with OpenRouter key
- [ ] Open `http://localhost:5173` (clinic app) — dark dashboard with 4 modules visible
- [ ] Complete a chat interview (streaming), see `CitationList` under AI responses
- [ ] Enter symptoms, see ranked differentials with probabilities + urgency badge
- [ ] Upload an X-ray or lab image, get structured vision analysis with findings
- [ ] Enter case + vitals, run triage, see Manchester-style RED/ORANGE/YELLOW/GREEN/BLUE badge
- [ ] Change language to Spanish (or Uzbek, Hindi, etc.), model responds in same language
- [ ] Switch LLM to GPT-4o or Gemini, retry same query successfully

### Patient App (Mobile Telemedicine)
- [ ] Open `http://localhost:5174` (patient app on different port)
- [ ] Chat with the AI avatar (Lottie animation visible)
- [ ] Enter VoiceMode for hands-free conversation with LiveKit integration
- [ ] Use SymptomCheck to guided entry; see analysis
- [ ] Access chat history + previous sessions resume correctly
- [ ] Upload medical images and view past analyses in Reports
- [ ] Run EmergencyCheck for rapid triage (RED/ORANGE/YELLOW)

### Cross-cutting
- [ ] Install clinic app as PWA on Android — splash + icon work
- [ ] Install patient app as PWA on iOS — standalone mode works
- [ ] Lighthouse PWA audit ≥ 90 for both apps
- [ ] Verify MongoDB persistence — sessions/chat history survives reload
- [ ] Read README.md, understand dual-app architecture, MongoDB setup, API docs without asking

---

## 7 · Risk Log

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Model returns non-JSON for `/symptoms`, `/triage`, `/reports` | Medium | `safeParseJson` regex repair + best-effort Zod validate (already in place) |
| 2 | Vision model refuses ("I cannot analyze medical images") | Medium | Prompt framing emphasizes copilot, not diagnosis. Fallback to a different OpenRouter vision model. |
| 3 | OpenRouter rate limit during live demo | Low | Pre-warmed backup key in `.env.demo`. Cache the 5 demo responses. |
| 4 | Whisper latency on slow network | Medium | Browser Web Speech API fallback (already wired) |
| 5 | Judge runs on Windows and our shell snippets are bash-only | Medium | README uses cross-platform `pnpm` commands; no bash-only steps |
| 6 | Multilingual quality drops for low-resource languages | Medium | Disclose this honestly in README; demo with high-quality languages first |
| 7 | TypeScript build fails on judge's Node version | Low | `engines` field requires Node ≥ 20; README states this |
| 8 | Live demo network fails | Medium | Keep a recorded 90-sec MP4 in `docs/` as a backup |

---

## 8 · Bugs / Issues

_None tracked yet. Use this section as the work begins._

| # | Title | Severity | Status | Owner |
|---|---|---|---|---|
| _ | _ | _ | _ | _ |

---

## 9 · Deferred (post-competition)

These are **intentionally out of scope** for v0.1.0. List them in the README too so judges see mature scoping.

- HIPAA / SOC 2 compliance review and DPA workflow
- Real EHR integration (HL7 / FHIR)
- Production vector database (pgvector or Qdrant) with a larger curated corpus
- Auth, RBAC, multi-tenant deployment
- Fine-tuned medical model (Med-PaLM-style)
- Native mobile (PWA is sufficient for the demo)
- Audit log, clinician override workflow, signed-off recommendations
- Text-to-speech (read-back of answers)
- Image format expansion: DICOM upload, PDF lab parsing
- Cost dashboard per session
- E2E test suite (Playwright) — only smoke testing for now

---

## 10 · Working Agreement

- **Always pnpm.** Never `npm install` — it will break the lockfile and workspaces.
- **TypeScript strict** — no `any` unless you `// eslint-disable-next-line` with a one-line reason.
- **Schemas before code.** Add or change `packages/shared/src/schemas.ts` first; let both ends import the inferred type.
- **No new dependencies without a TODO entry.** Every dep should be justified in a PR description.
- **No `.env` ever committed.** The `.gitignore` already excludes it; double-check before each commit.
- **Conventional commits** for clean history: `feat(web): ...`, `fix(api): ...`, `docs: ...`, `chore: ...`.
- **Branching**: one feature branch per page/concern → PR into `develop` → squash-merge. Tag `v0.1.0` from `develop`, then merge to `main`.
- **Don't refactor what works.** Two weeks. Add features, fix bugs, polish — don't restructure.

---

## 11 · Owner Assignments (fill in)

| Track | Owner | ETA |
|---|---|---|
| Frontend pages (Home, Interview, Symptoms, Reports, Triage) | _____ | Day 7 |
| Smoke test + TS error fixes | _____ | Day 8 |
| Multilingual + PWA verification | _____ | Day 9 |
| Screenshots + `docs/DEMO.md` | _____ | Day 10 |
| `docs/architecture.svg` + README polish | _____ | Day 11 |
| Polish pass (loading/empty/error/a11y) | _____ | Day 12 |
| Demo rehearsal | _____ | Day 13 |
| Tag + submit | _____ | Day 14 |

---

## 12 · Quick Reference

- **API contracts:** `packages/shared/src/schemas.ts`
- **System prompts:** `packages/shared/src/prompts.ts`
- **Seed knowledge:** `packages/shared/src/medical-knowledge.ts`
- **API client (frontend):** `apps/web/src/lib/api.ts`
- **Theme tokens:** `apps/web/tailwind.config.ts`
- **Env contract:** `.env.example`
- **Why decisions:** [README.md](./README.md)
