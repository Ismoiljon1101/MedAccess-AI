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
| `packages/shared` (schemas, prompts, knowledge) | ✅ Done |
| `apps/api` (Express + TS, all 5 routes) | ✅ Done |
| `apps/web` foundations (theme, layout, components, API client) | ✅ Done |
| `apps/web` module pages | 🚧 In progress |
| Smoke test / typecheck / build | 📋 Todo |
| Screenshots + demo script + README polish | 📋 Todo |
| Multilingual e2e + PWA install verification | 📋 Todo |
| Tag `v0.1.0` + final push | 📋 Todo |

---

## 1 · Locked Architecture (do not relitigate)

| | |
|---|---|
| Package manager | **pnpm** workspaces only — no `npm install` |
| Language | **TypeScript strict**, every source file |
| Backend | Express + TS, Zod-validated, OpenAI SDK pointed at OpenRouter |
| Frontend | Vite + React 18 + TS + Tailwind + `vite-plugin-pwa` + Zustand + react-router v6 |
| LLM provider | **OpenRouter** (single `OPENROUTER_API_KEY`); model picker in UI |
| Voice (STT) | OpenAI Whisper if `OPENAI_API_KEY` set, else browser Web Speech API |
| RAG | BM25 keyword similarity over 15 seed clinical docs (no embeddings) |
| Storage | In-memory session map with TTL sweep |
| Env file | Single root `.env` (loaded by `apps/api/src/server.ts`) |
| Code style | No emojis in code/comments unless asked; comments only where the *why* is non-obvious |

---

## 2 · Repository Map

```
MedAccess-AI/
├── apps/
│   ├── api/                    ✅ Built
│   │   └── src/
│   │       ├── server.ts       — entry; loads root .env; mounts routes
│   │       ├── routes/         — chat, symptoms, triage, reports, transcribe
│   │       ├── services/       — llm (OpenRouter), vision, transcribe, rag (BM25)
│   │       ├── middleware/     — error, upload (multer)
│   │       └── utils/          — sessions (in-memory + TTL)
│   └── web/                    🚧 Foundations done, pages remaining
│       └── src/
│           ├── main.tsx        ✅
│           ├── App.tsx         ✅ (router)
│           ├── index.css       ✅ (Tailwind + theme)
│           ├── components/     ✅ Layout, Sidebar, Header, Disclaimer,
│           │                       VoiceButton, MessageBubble, TriageBadge,
│           │                       ProbabilityBar, CitationList
│           ├── pages/          🚧 Home ✅; Interview, Symptoms, Reports, Triage 📋
│           ├── lib/            ✅ api.ts, i18n.ts, models.ts
│           └── store/          ✅ app.ts (Zustand prefs)
├── packages/
│   └── shared/                 ✅ Built
│       └── src/
│           ├── schemas.ts      — all Zod request/response schemas
│           ├── prompts.ts      — every system prompt
│           ├── medical-knowledge.ts — 15 seed RAG docs
│           ├── types.ts        — ambient types
│           └── index.ts        — re-exports
├── docs/                       📋 architecture.svg, screenshots/*.png, DEMO.md
├── .env.example                ✅
├── pnpm-workspace.yaml         ✅
├── tsconfig.base.json          ✅
├── package.json                ✅ (root scripts)
├── README.md                   ✅ professor-grade
└── TODO.md                     ✅ this file
```

---

## 3 · Sprint 1 — Week 1 (May 26 → Jun 1)

### ✅ Days 1–2 · Foundation
- [x] Competitive + LLM landscape research
- [x] Plan approved (OpenRouter, PWA, single repo, TS, pnpm)
- [x] `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`
- [x] `.env.example` (OPENROUTER_API_KEY required, OPENAI_API_KEY optional)
- [x] `.gitignore` (no `.env`, no `node_modules`, no `dist`)
- [x] Save architecture & deadline to project memory

### ✅ Days 3–4 · Shared package + API
- [x] `packages/shared` — Zod schemas for all endpoints
- [x] System prompts (interview, symptom analysis, triage, vision report)
- [x] Seed medical knowledge (15 entries: malaria, dengue, sepsis, pneumonia, ACS, stroke, etc.)
- [x] `apps/api/src/services/llm.ts` — OpenRouter client (chat + streaming + JSON mode + safe parse)
- [x] `apps/api/src/services/vision.ts` — multimodal image analysis
- [x] `apps/api/src/services/transcribe.ts` — Whisper STT (optional)
- [x] `apps/api/src/services/rag.ts` — BM25 retrieval
- [x] `apps/api/src/middleware/` — error + multer upload
- [x] `apps/api/src/utils/sessions.ts` — in-memory + TTL sweep
- [x] Routes: `chat` (+ `/stream`), `symptoms`, `triage`, `reports`, `transcribe`
- [x] `server.ts` — mounts all routes, health endpoint, root `.env` loader

### ✅ Days 5–6 · Web foundations
- [x] Vite config with React + PWA plugin + `/api` proxy
- [x] Tailwind config + dark `ink` palette + `accent` teal
- [x] `index.html` (Inter + JetBrains Mono via Google Fonts)
- [x] PWA manifest + 192/512 SVG icons + favicon
- [x] Global CSS (cards, buttons, inputs, scrollbar, prose styles)
- [x] `main.tsx` + `App.tsx` (BrowserRouter with 5 routes)
- [x] `Layout`, `Sidebar`, `Header` (language picker + model picker + health chip)
- [x] `Disclaimer` (banner on every page)
- [x] `VoiceButton` (Whisper → browser fallback)
- [x] `MessageBubble`, `TriageBadge`, `ProbabilityBar`, `CitationList`
- [x] `lib/api.ts` typed client for every endpoint, with SSE streaming
- [x] `lib/i18n.ts` (17 languages incl. Uzbek, Hausa, Swahili, Amharic)
- [x] `lib/models.ts` (Claude Sonnet 4.5, GPT-4o/-mini, Gemini Flash, Llama 3.3, DeepSeek)
- [x] `store/app.ts` (Zustand, persisted prefs)

### 🚧 Day 7 · Frontend pages (the remaining surface)

Each page must: import the typed API client, use the Zustand store for `language`+`model`, render loading + empty + error states, and include the `VoiceButton` wherever free-text input exists.

- [x] **`apps/web/src/pages/Home.tsx`** ✅
  - Hero with tagline + CTA buttons
  - 4 module cards (Interview, Symptoms, Reports, Triage) linking to routes
  - 5 differentiator cards (LLM-agnostic, Multilingual, Voice, PWA, Safety)
  - Uses existing `card`/`btn` theme classes
- [ ] **`apps/web/src/pages/Interview.tsx`**
  - Streaming chat using `streamChat()` from `lib/api.ts`
  - Render `MessageBubble[]` from session state
  - Voice input → fills the textarea
  - Show `CitationList` under each AI message
  - "New session" button (clears session id)
- [ ] **`apps/web/src/pages/Symptoms.tsx`**
  - Symptom chip input (Enter to add, X to remove)
  - Patient context form: age, sex, pregnancy, conditions, meds, allergies
  - Call `analyzeSymptoms()` → render `ProbabilityBar[]` sorted desc
  - Urgency badge + "Recommended next steps" list + disclaimer
- [ ] **`apps/web/src/pages/Reports.tsx`**
  - Drag-and-drop image upload (also click-to-pick)
  - Optional note textarea
  - Image preview
  - Call `analyzeReport()` → render `imageType`, `qualityNotes`, `keyObservations[]`, `possibleFindings[]` (with confidence chips), `suggestedFollowUp[]`, `disclaimer`
- [ ] **`apps/web/src/pages/Triage.tsx`**
  - Case textarea (with voice input)
  - Vitals grid (HR, RR, SBP, DBP, SpO2, Temp, GCS)
  - Call `runTriage()` → render `TriageBadge` + `targetTimeToCare` + `rationale` + actions + warning signs

**Owner:** _(to assign)_  · **ETA:** 1 day  · **Acceptance:** all four routes navigate, the happy path round-trips the API, errors surface as a non-cryptic toast/banner.

---

## 4 · Sprint 2 — Week 2 (Jun 2 → Jun 9)

### Day 8 · Smoke test & TS hygiene
- [ ] `pnpm install` succeeds on a clean clone (Windows + macOS)
- [ ] `pnpm typecheck` passes for all three workspaces (`apps/api`, `apps/web`, `packages/shared`)
- [ ] `pnpm build` builds API + web without warnings
- [ ] `pnpm dev` starts API on `:4000` and web on `:5173` in parallel
- [ ] Hit `GET /api/health` and verify all flags green

### Day 9 · Multilingual + PWA verification
- [ ] Manually test each module in: English, Spanish, Uzbek, Hindi
- [ ] Verify the model mirrors the input language (does not always answer in English)
- [ ] Lighthouse PWA audit ≥ 90
- [ ] Install on Android Chrome ("Add to Home Screen") — verify splash + icon
- [ ] Install on iOS Safari ("Add to Home Screen") — verify standalone

### Day 10 · Screenshots + demo content
- [ ] `docs/screenshots/01-home.png`
- [ ] `docs/screenshots/02-interview.png` (mid-conversation, with citations visible)
- [ ] `docs/screenshots/03-symptoms.png` (ranked differential)
- [ ] `docs/screenshots/04-reports.png` (X-ray reading)
- [ ] `docs/screenshots/05-triage.png` (RED case)
- [ ] `docs/screenshots/06-pwa-install.png` (phone)
- [ ] `docs/DEMO.md` — exact inputs for a 3-minute demo

### Day 11 · README polish + architecture diagram
- [ ] `docs/architecture.svg` (one-page system diagram)
- [ ] Embed screenshots in README
- [ ] Verify all internal links resolve
- [ ] Spellcheck pass

### Day 12 · Polish pass
- [ ] Loading skeletons everywhere (no jarring layout shifts)
- [ ] Empty states everywhere ("no analysis yet — fill in fields above")
- [ ] Error toasts that surface `err.message` from the API
- [ ] Keyboard: Enter submits forms, Esc closes voice modal
- [ ] Mobile breakpoint check (< 640px) — sidebar collapses, header wraps cleanly
- [ ] Accessibility: focus rings, `aria-label` on icon buttons

### Day 13 · Demo dress rehearsal
- [ ] Run the full `docs/DEMO.md` flow end-to-end, twice, timed
- [ ] Cache the 5 demo prompts in a fallback static page in case of network failure
- [ ] Pre-warm a backup OpenRouter key
- [ ] Verify projector-friendly contrast on the dark theme

### Day 14 · Submission
- [ ] Final commit on `develop`
- [ ] Tag `v0.1.0`
- [ ] Open PR `develop` → `main`
- [ ] Submit per competition instructions

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

A judge can:
- [ ] Clone the repo and run `pnpm install && pnpm dev` with no errors after adding an OpenRouter key
- [ ] Open `http://localhost:5173`, see the dark dashboard, see all 4 modules clickable
- [ ] Complete a chat interview, see citations under the AI message
- [ ] Analyze a symptom list and see a ranked differential with probabilities
- [ ] Upload a sample X-ray and get a structured reading
- [ ] Triage a case and see a Manchester-color badge with rationale
- [ ] Switch the response language to Spanish (or any of 17) and verify the model mirrors it
- [ ] Switch the model to GPT-4o or Gemini and retry the same query
- [ ] Install the PWA on a phone and reopen it as a standalone app
- [ ] Read the README and understand the architecture, decisions, and roadmap without asking questions

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
