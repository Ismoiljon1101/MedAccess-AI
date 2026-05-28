# MedAccess AI

> **AI Doctor Copilot for rural and underserved areas.**
> Multilingual · Voice-first · Multimodal · Grounded in clinical references.

[![Stack](https://img.shields.io/badge/stack-pnpm%20%C2%B7%20TS%20%C2%B7%20React%20%C2%B7%20Express-22b8a3?style=flat-square)](#tech-stack)
[![LLM](https://img.shields.io/badge/LLM-OpenRouter%20(multi--model)-22b8a3?style=flat-square)](#why-openrouter)
[![PWA](https://img.shields.io/badge/PWA-installable-22b8a3?style=flat-square)](#installable-pwa)
[![License](https://img.shields.io/badge/license-MIT-22b8a3?style=flat-square)](#license)
[![Status](https://img.shields.io/badge/status-MVP%20v0.1-orange?style=flat-square)](./TODO.md)

> ⚠️ **Not a medical device.** This project is an educational decision-support
> *copilot*. It does not diagnose, prescribe, or replace a licensed clinician.
> See [Safety & Disclaimer](#safety--disclaimer).

---

## Table of Contents

- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [What Makes Us Different](#what-makes-us-different)
- [Quickstart](#quickstart)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Modules](#modules)
- [Differentiators](#differentiators)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Why OpenRouter?](#why-openrouter)
- [Why BM25, not embeddings?](#why-bm25-not-embeddings)
- [Why a PWA, not native?](#why-a-pwa-not-native)
- [Safety & Disclaimer](#safety--disclaimer)
- [Roadmap & Deferred Work](#roadmap--deferred-work)
- [Testing](#testing)
- [Project Management](#project-management)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## The Problem

The WHO estimates roughly **half the world's population lacks access to essential
health services**. In rural Uzbekistan, Ethiopia, Bangladesh, Indonesia and
hundreds of other underserved regions, a single nurse or general practitioner
often serves thousands of patients across **multiple local languages**, with
**limited diagnostic equipment** and **no specialist referral** within hours of travel.

Three concrete pain points define the day-to-day:

1. **Severe shortage of clinicians** in rural zones — minutes per patient.
2. **Language barriers** in diagnostic interviews — patients and providers don't
   always share a fluent common language.
3. **Delayed response in emergencies** — no on-site specialist, no second opinion.

Meanwhile, the dominant clinical-AI products of 2026 — OpenEvidence, Glass Health,
Hippocratic AI, Vera Health — are all built **for well-resourced US/EU
clinicians on fast internet, in English, behind EHRs like Epic.** None of them
target the rural, multilingual, low-bandwidth segment.

That gap is our wedge.

---

## Our Solution

**MedAccess AI** is a clinical decision-support copilot designed *first* for the
frontline provider in an underserved clinic. It runs in any browser, installs on
any phone, speaks 17+ languages out of the box, accepts voice input, and
analyzes X-rays / ECGs / lab photos via multimodal vision.

It is **not** a diagnostic device. It is the second pair of eyes a clinician
working alone never had.

### Two Portals, One API

| Portal | URL | Who it's for |
|---|---|---|
| **`apps/clinic`** | `:5173` | Doctors, nurses, frontline clinicians — full clinical toolset, model picker, RAG citations, probability bars |
| **`apps/patient`** | `:5174` | Patients — simplified symptom checker and emergency guide, plain language, no technical details |
| **`apps/api`** | `:4000` | Shared backend serving both portals |

Both portals share the same API and `packages/shared` contract. The patient portal intentionally hides model selection, probability percentages — surfacing only plain-language results and urgency guidance.

### Five Core Modules

| # | Module | Portal | What it does |
|---|---|---|---|
| 1 | **MA Agent Chat** | Patient | Conversational health assistant — structured interview, image upload inline, RAG-grounded, citation chips, session history |
| 2 | **Interview** | Clinic | Structured diagnostic intake for clinicians — one focused question at a time, RAG context, citation chips per turn |
| 3 | **Symptom Analysis** | Clinic | Ranked differential (3–6 conditions) with calibrated probabilities, urgency level, red-flag callouts |
| 4 | **Report Reading** | Both | Upload X-ray / ECG / lab photo → structured plain-language reading with findings + confidence levels |
| 5 | **Triage** | Both | Manchester-style colors (RED → BLUE) with target time-to-care and immediate action list |

### Five Cross-cutting Differentiators

| # | Differentiator | Why it matters |
|---|---|---|
| 1 | **MA Agent identity** | Patients talk to "MA Agent" — a named, trusted assistant. Refuses to reveal underlying model or provider. |
| 2 | **Multilingual** (auto-detect, 17 surfaced) | The model mirrors the user's language. Hindi → Hindi, Uzbek → Uzbek. |
| 3 | **Voice-first** | Full-screen immersive voice mode (LiveKit + Web Speech API) + inline mic in chat — zero API key needed for demos. |
| 4 | **Multimodal vision** | Snap a photo of an ECG strip or chest X-ray directly in the chat — get a structured read inline. |
| 5 | **Medical RAG** | Every chat turn grounded in 31 vetted clinical docs; sources surface as chips below each answer. |
| 6 | **Installable PWA** | One tap on a phone → standalone app icon → works under spotty connectivity. |

---

## What Makes Us Different

| Tool | Audience | Geography | Multilingual | Voice | Multimodal | Offline-friendly |
|---|---|---|---|---|---|---|
| **OpenEvidence** | US specialists | USA | ❌ EN-only | ❌ | ❌ | ❌ |
| **Glass Health** | US clinicians | USA | ❌ | ❌ | ❌ | ❌ |
| **Hippocratic AI** | Patients (phone) | USA | Limited | ✅ phone | ❌ | ❌ |
| **Vera Health** | US/EU clinicians | USA/EU | Limited | ❌ | ❌ | ❌ |
| **MedAccess AI** | Rural GP / nurse | **Global South** | **✅ 17+** | **✅** | **✅** | **✅ PWA** |

We are not competing for the well-served US specialist. We are building for the
**next billion patients** that the incumbents structurally cannot reach.

---

## Quickstart

> Prereqs: **Node 20+** and **pnpm 9+** (`npm i -g pnpm`).

```bash
git clone https://github.com/Ismoiljon1101/MedAccess-AI.git
cd MedAccess-AI

# 1. Install (single command for the whole monorepo)
pnpm install

# 2. Configure
cp .env.example .env
# Open .env and paste your OPENROUTER_API_KEY from https://openrouter.ai/keys
# (OPENAI_API_KEY is optional — only needed for Whisper STT.)

# 3. Run all three apps in parallel
pnpm dev
# API     → http://localhost:4000
# Clinic  → http://localhost:5173   (doctors / nurses)
# Patient → http://localhost:5174   (patients)

# Or run individually
pnpm dev:api      # API only
pnpm dev:clinic   # Clinic portal only
pnpm dev:patient  # Patient portal only
```

- **Clinic portal** `http://localhost:5173` — dark dashboard with 4 module cards (Interview, Symptoms, Reports, Triage), model picker, RAG citations, probability bars.
- **Patient portal** `http://localhost:5174` — MA Agent chat (streaming, voice, inline image upload), Find Care, Emergency triage, Records, Settings. Installable as PWA.

To install as a PWA: open either site in Chrome on your phone (or desktop) →
address-bar "Install" icon → done.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             USER (browser or installed PWA)                      │
└──────────────┬──────────────────────────────────────────────────┬───────────────┘
               │  Clinician                                        │  Patient
               ▼                                                   ▼
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│  apps/clinic  :5173             │         │  apps/patient  :5174             │
│  (Vite + React + TS)            │         │  (Vite + React + TS)             │
│  ── Sidebar · Header            │         │  ── MA Agent (named identity)    │
│  ── Model picker (8 models)     │         │  ── No model picker exposed      │
│  ── Pages: Home · Interview     │         │  ── Pages: Chat · VoiceMode      │
│       Symptoms · Reports        │         │       EmergencyCheck · FindCare  │
│       Triage                    │         │       MyRecords · Settings       │
│  ── RAG citations visible       │         │  ── Citation chips under replies │
│  ── Probability % bars          │         │  ── No % bars                    │
│  ── VoiceButton                 │         │  ── Inline image upload in chat  │
└──────────────┬──────────────────┘         └──────────────┬───────────────────┘
               │   /api/*  (Vite proxy → :4000)            │   /api/*
               └──────────────────────┬────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              apps/api  :4000  (Express + TS)                     │
│                                                                                  │
│   routes/  ── chat (+stream) · symptoms · triage · reports · transcribe · voice │
│   services/                                                                      │
│      ├── llm.ts          → OpenRouter (OpenAI SDK, baseURL swap)                │
│      ├── vision.ts       → multimodal image → structured JSON                   │
│      ├── transcribe.ts   → OpenAI Whisper (optional key)                        │
│      └── rag.ts          → BM25 over 31 seed clinical docs                      │
│   middleware/  ── error · upload (multer)                                        │
│   utils/       ── sessions (in-memory + TTL)                                    │
│   packages/db  ── MongoDB + Mongoose (Interview model, fire-and-forget)         │
└──────────────────────────┬──────────────────────────────┬───────────────────────┘
                            │                              │
                            ▼                              ▼
               ┌────────────────────┐           ┌──────────────────┐
               │  OpenRouter API    │           │  OpenAI Whisper  │
               │  (one key,         │           │  (optional)      │
               │   any model)       │           └──────────────────┘
               └────────────────────┘
                            │
   anthropic/claude-sonnet-4.5  ·  openai/gpt-4o  ·  google/gemini-2.0-flash
   meta-llama/llama-3.3-70b:free  ·  deepseek/deepseek-r1:free  ·  + more
```

### Single Source of Truth

```
packages/shared/
  └── src/
      ├── schemas.ts            ← Zod schemas; types inferred for both ends
      ├── prompts.ts            ← Every system prompt the API uses
      ├── medical-knowledge.ts  ← Seed RAG corpus (31 clinical references)
      └── types.ts              ← Ambient TS types
```

All three apps (`apps/api`, `apps/clinic`, `apps/patient`) import from `@medaccess/shared`. There is **no
duplicate definition of an API contract** anywhere in the codebase.

### Atomic Design System

Our frontend UI architecture implements the **Atomic Design methodology** to organize components cleanly, making the codebase highly modular, searchable, and AI-friendly:

- **Atoms:** `TriageBadge` · `ProbabilityBar` · `VoiceButton` · `AiAvatar` (Lottie, 3 states)
- **Molecules:** `MessageBubble` · `CitationList`
- **Organisms:** `Header` · `Sidebar` · `Disclaimer` · `Layout`
- **Pages (Clinic):** `Home` · `Interview` · `Symptoms` · `Reports` · `Triage`
- **Pages (Patient):** `Chat` · `VoiceMode` · `EmergencyCheck` · `FindCare` · `MyRecords` · `History` · `Settings`

### Request Lifecycle (Symptom Analysis example)

```
1. user enters symptoms in clinic/src/pages/Symptoms.tsx (or patient/src/pages/SymptomCheck.tsx)
2. lib/api.ts → POST /api/symptoms with { symptoms, patient, language, model }
3. apps/api/routes/symptoms.ts validates with SymptomsRequestSchema
4. services/rag.ts → BM25 retrieval against seed knowledge
5. services/llm.ts → OpenRouter chat with json_object response_format
6. safeParseJson() → fallback regex repair → Zod best-effort validate
7. Response: { analysis, model, citations, ragStatus }
8. UI renders ProbabilityBar[] sorted desc + urgency + next steps
```

---

## Docs

| File | Description |
|---|---|
| [`docs/ER_model.mmd`](./docs/ER_model.mmd) | Full ER diagram — post-MVP database schema (Mermaid) |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Layered system architecture with Mermaid diagram |
| [`docs/ER_MODEL.md`](./docs/ER_MODEL.md) | ER model with annotations, migration path from MVP |
| [`TODO.md`](./TODO.md) | Sprint tracker, acceptance criteria, risk log |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Repo** | pnpm workspaces | Fast, disk-efficient, first-class monorepo support |
| **Language** | TypeScript strict | Type safety matters for medical code; shared types via `packages/shared` |
| **Backend** | Express 4 + TS | Well-known, minimal, fast to write; Fastify deferred |
| **Validation** | Zod | Schemas double as TS types and runtime validators |
| **Frontend** | React 18 + Vite + TS | Industry-standard, sub-second HMR |
| **Styling** | Tailwind CSS + custom `ink`/`accent` palette | Dark-mode trivial; matches pitch-deck aesthetic |
| **State** | Zustand (persisted) | Smaller than Redux, no boilerplate, persists prefs (language + model) |
| **Routing** | react-router v6 | De facto |
| **PWA** | `vite-plugin-pwa` (Workbox) | Auto-update service worker, generated manifest |
| **LLM gateway** | **OpenRouter** | One key → 50+ models from Anthropic, OpenAI, Google, Meta, DeepSeek |
| **LLM (default chat/vision)** | `anthropic/claude-sonnet-4.5` | Top of HealthBench medical benchmark in 2026 |
| **LLM (fast/cheap fallback)** | `openai/gpt-4o-mini`, `google/gemini-2.0-flash` | Sub-cent demo cost |
| **Voice STT** | Web Speech API (primary) + OpenAI Whisper (optional) | Zero-key fallback for demos; Whisper for production accuracy |
| **Voice mode** | LiveKit + Web Speech TTS | Full-screen immersive voice UI; standalone fallback if LiveKit unconfigured |
| **Avatar** | Lottie (`lottie-react`) | Animated doctor avatar, 3 states: idle / listening / thinking |
| **RAG** | BM25 over **31 seed docs** | Zero infra; covers 25+ clinical topics; embeddings deferred |
| **Sessions** | In-memory map + TTL sweep | Zero infra; Redis deferred |
| **Persistence** | MongoDB + Mongoose (`packages/db`) | Fire-and-forget; app works even if DB is down |
| **Tooling** | tsx (dev), tsc (build) | Single-file dev loop |

---

## Modules

### 1. Interview · `/interview`

A structured conversational intake. The model asks **one focused question at a
time**, in the user's language, working through chief complaint → onset →
associated symptoms → relevant history → red flags. After 5–8 turns it produces
a "Clinical Snapshot" and offers to hand off to Symptom Analysis or Triage.

- Streams responses token-by-token over Server-Sent Events for sub-second feel.
- Auto-attaches Medical RAG context; sources appear as chips under each answer.
- Voice input via the floating mic button — Whisper if `OPENAI_API_KEY` is set,
  else browser Web Speech API.

### 2. Symptom Analysis · `/symptoms`

Takes a structured symptom list + optional patient context (age, sex, pregnancy,
known conditions, meds, allergies) and returns:

```ts
{
  differentials: [
    { condition, likelihood: 'high'|'moderate'|'low',
      probabilityPct: 0..100, reasoning, redFlags: [...] }
  ],
  recommendedNextSteps: [...],
  urgency: 'self-care' | 'see-clinician-soon' | 'urgent' | 'emergency',
  disclaimer: string
}
```

Calibrated probabilities — not the "everything is 95%" pattern of naive LLM use.
3–6 differentials, ranked by `probabilityPct` desc.

### 3. Report Reading · `/reports`

Drag-and-drop a photo of a medical image (X-ray, ECG strip, lab printout,
dermatology photo). The vision model returns:

```ts
{
  imageType, qualityNotes, keyObservations: [...],
  possibleFindings: [{ finding, confidence, notes }],
  suggestedFollowUp: [...], disclaimer
}
```

If the image isn't medical or isn't readable, `imageType` becomes `"unknown"`
and the model says why instead of fabricating findings.

### 4. Triage · `/triage`

Brief case + vitals → Manchester-style triage:

```ts
{
  level: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE',
  levelLabel, targetTimeToCare,    // e.g. 'Immediate', '<10 min'
  rationale, actions: [...], warningSigns: [...]
}
```

The prompt forbids downgrading chest pain, stroke-like deficits, severe
respiratory distress, anaphylaxis, or active hemorrhage below ORANGE — a
deliberate safety floor.

---

## Differentiators

### Multilingual

17 languages surfaced in the picker: English, Spanish, French, Portuguese,
Arabic, Hindi, Bengali, Urdu, Swahili, Amharic, Hausa, Uzbek, Russian, Chinese,
Indonesian, Turkish, plus auto-detect. The model **mirrors** whatever language
the user writes in — the picker is a hint, not a constraint.

### Voice-first

Mic button on every free-text input. Two paths:

- **Server-side (preferred):** records `audio/webm` → POST `/api/transcribe` →
  OpenAI Whisper → text fills the input. Requires `OPENAI_API_KEY`.
- **Browser fallback:** Web Speech API (`SpeechRecognition`). Works on Chrome /
  Edge without any backend key — perfect for zero-config demos.

### Multimodal vision

Any OpenRouter model with vision support works (`anthropic/claude-sonnet-4.5`,
`openai/gpt-4o`, `google/gemini-2.0-flash-exp:free`). The image is base64-encoded
client-side and passed through the OpenRouter chat completions endpoint with
`response_format: { type: 'json_object' }` so the read is always structured.

### Medical RAG

**31 high-signal clinical reference documents** covering: tropical infections
(malaria, dengue, TB), pediatric emergencies (IMCI thresholds, dehydration,
oral rehydration), cardiology (ACS, chest pain differential, hypertension
crisis), neurology (stroke BE-FAST, migraine, headache red flags), obstetrics
(pre-eclampsia / eclampsia), sepsis (qSOFA bundle), asthma, anaphylaxis,
mental-health screening, UTI, appendicitis, renal colic, DVT/PE, wound
infection, gastroenteritis, allergic rhinitis, back pain red flags, COVID-19,
diabetes/DKA, fever approach, and skin rash.

BM25-scored at request time; top 3–4 hits injected into the system prompt;
source titles surface as citation chips under every AI reply in both portals.

### Installable PWA

`vite-plugin-pwa` generates a Workbox service worker, a web app manifest, and
192/512 maskable icons. The shell is cached; API calls always go to the network.
Lighthouse PWA score target: **≥ 90**.

---

## API Reference

Base URL: `http://localhost:4000` (or proxied via `/api/*` in dev).

### `GET /api/health`
```json
{
  "status": "ok",
  "version": "0.1.0",
  "providers": { "openrouter": true, "openaiWhisper": false },
  "defaultModel": "google/gemini-2.0-flash-exp:free",
  "rag": { "ready": true, "size": 31 },
  "db": { "connected": true }
}
```

### `POST /api/voice/token`
Returns a LiveKit room token for the immersive voice mode.
```json
{ "token": "...", "url": "wss://...", "room": "session-xyz", "identity": "patient-abc" }
```

### `GET /api/voice/status`
```json
{ "configured": true }
```

### `POST /api/chat`
```json
{
  "message": "I've had fever and chills for 3 days, with night sweats.",
  "language": "English",
  "model": "anthropic/claude-sonnet-4.5",
  "useRag": true
}
```
Returns `{ sessionId, message, model, citations }`.

### `POST /api/chat/stream`
Same body. Returns Server-Sent Events:
- `event: meta`  → `{ sessionId, citations }`
- `event: token` → `{ delta: "..." }` (repeats)
- `event: done`  → `{ sessionId }`

### `POST /api/symptoms`
```json
{
  "symptoms": ["severe headache", "visual changes", "RUQ pain"],
  "patient": { "age": 32, "sex": "female", "pregnancy": true },
  "language": "English"
}
```

### `POST /api/triage`
```json
{
  "caseSummary": "45M, crushing chest pain 30 min, diaphoretic.",
  "vitals": { "hrBpm": 110, "sbpMmHg": 90, "spo2Pct": 94 }
}
```

### `POST /api/reports/analyze`
Multipart: `image` (PNG / JPEG / WEBP / GIF, ≤ 15 MB), optional `note`, `language`, `model`.

### `POST /api/transcribe`
Multipart: `audio` (webm / ogg / wav / mp3 / mp4), optional `language`.
Returns `{ text, language, duration, model }`.
Requires `OPENAI_API_KEY`.

### `GET /api/transcribe/status`
Returns `{ available: boolean, provider: 'openai-whisper' | 'web-speech-api-fallback' }`.

---

## Environment Variables

All env vars live in a **single `.env` at the repo root**. Copy from `.env.example`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **yes** | — | Get one at https://openrouter.ai/keys |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` | |
| `OPENROUTER_CHAT_MODEL` | no | `anthropic/claude-sonnet-4.5` | Default for chat |
| `OPENROUTER_FAST_MODEL` | no | `openai/gpt-4o-mini` | Optional fast path |
| `OPENROUTER_VISION_MODEL` | no | `anthropic/claude-sonnet-4.5` | Must support image input |
| `OPENROUTER_APP_NAME` | no | `MedAccess AI` | Sent to OpenRouter for analytics |
| `OPENROUTER_APP_URL` | no | `http://localhost:5173` | Sent to OpenRouter |
| `OPENAI_API_KEY` | no | — | Only if you want server-side Whisper STT |
| `OPENAI_WHISPER_MODEL` | no | `whisper-1` | |
| `MONGODB_URI` | no | — | Persist sessions to MongoDB; app works without it |
| `LIVEKIT_URL` | no | — | `wss://your-project.livekit.cloud` — enables LiveKit voice mode |
| `LIVEKIT_API_KEY` | no | — | From LiveKit dashboard |
| `LIVEKIT_API_SECRET` | no | — | From LiveKit dashboard |
| `PORT` | no | `4000` | API port |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Comma-separate for multiple ports |
| `MAX_UPLOAD_MB` | no | `15` | Image / audio size cap |
| `SESSION_TTL_MIN` | no | `60` | Idle-session TTL |

---

## Why OpenRouter?

We considered Anthropic + OpenAI + Google direct integration. We picked
[OpenRouter](https://openrouter.ai) because:

1. **One key, every model.** Claude Sonnet 4.5, GPT-4o, Gemini 2.0, Llama 3.3,
   DeepSeek — all behind one OpenAI-compatible API.
2. **Runtime model switch.** The UI has a model picker. Judges can compare
   models on the same prompt in one click — a quality-engineering signal.
3. **Cheaper.** Many models route through aggregated capacity at a discount.
4. **Zero migration cost.** OpenAI SDK works unchanged — just point `baseURL` at
   `https://openrouter.ai/api/v1`.
5. **No vendor lock-in.** If OpenRouter goes down, we swap the base URL back to
   `api.openai.com` and the code still works.

The one gap: OpenRouter does **not** proxy the OpenAI **audio** API. So Whisper
STT requires a direct `OPENAI_API_KEY` — and even that is optional thanks to
the Web Speech API fallback.

---

## Why BM25, not embeddings?

The seed corpus is **31 documents**. At that size:

- BM25 keyword similarity with IDF + length normalization is, empirically, on
  par with cosine-similarity over embeddings for clinical short-text retrieval.
- We avoid an entire embedding API call per request (cost + latency).
- We avoid running a vector store (pgvector / Pinecone / Qdrant).
- The whole MVP runs with **only an OpenRouter key**.

When the corpus grows past ~200 docs, we'll switch to embeddings + pgvector and
keep BM25 as a hybrid first-stage retriever. That upgrade is one file change
(`apps/api/src/services/rag.ts`) thanks to the clean interface.

---

## Why a PWA, not native?

Our user lives in a rural clinic on Android Go with a 3G connection. They don't
have an Apple Developer account, can't install random APKs, and the IT budget
is zero.

A PWA installs in 5 seconds from a Chrome address bar, runs fullscreen with an
app icon, caches its shell offline, and updates silently. We get 95% of the
"native app" feel for 0% of the App Store / Play Store overhead.

If we win the competition and an investor asks for native: React → React Native
shares >70% of the code and is a 1-month port. Day 1 doesn't need it.

---

## Safety & Disclaimer

MedAccess AI is **not a medical device** and is **not regulated by any health
authority**. It is an *educational decision-support copilot*. Every system
prompt enforces:

- The model is **not a licensed clinician**.
- Output is **not a diagnosis or prescription**.
- Red-flag symptoms always trigger an explicit "seek in-person evaluation"
  recommendation.
- Uncertainty is quantified in plain language ("most likely", "possible",
  "unlikely") — never as false confidence.
- The model **must not fabricate** medication dosages, lab reference ranges, or
  guideline citations.
- The triage prompt has a **safety floor**: chest pain, stroke-like deficits,
  severe dyspnea, anaphylaxis, and active hemorrhage cannot be downgraded
  below ORANGE.

A non-dismissible disclaimer banner appears at the top of every page.

We do not store patient data. There is no database. Sessions live in server RAM
with a TTL and a sweep, and clear on restart. Real-world deployment would
require HIPAA / GDPR / local-equivalent work — see [Roadmap](#roadmap--deferred-work).

---

## Roadmap & Deferred Work

These are **intentionally out of scope for v0.1.0**. They are not oversights —
they are conscious cuts to ship a credible demo in 14 days.

| Area | Plan |
|---|---|
| Compliance | HIPAA, GDPR, DPAs, BAAs with LLM providers |
| Storage | Postgres + Redis; encrypted patient records; audit log |
| RAG | Embeddings + pgvector; ingest WHO / MSF / CDC corpus (~5k docs) |
| EHR | HL7 / FHIR write-back of clinician-signed summaries |
| Auth | Clinician auth, RBAC, multi-tenant clinics |
| Models | Evaluate fine-tuned medical models (Med-PaLM, Apollo) |
| Mobile | React Native port (PWA-shared 70%+ of code) |
| Imaging | DICOM upload; PDF lab parsing |
| Voice | Text-to-speech read-back; on-device Whisper.cpp for offline STT |
| Observability | OpenTelemetry traces, cost-per-session dashboard |
| Testing | Playwright E2E, Vitest unit, k6 load |

See the live task tracker in [TODO.md](./TODO.md).

---

## Testing

For v0.1.0 we ship with manual smoke testing — disciplined but not automated.
Run in this order before tagging a release:

```bash
pnpm install          # clean install
pnpm typecheck        # all three workspaces pass tsc --noEmit
pnpm build            # API + web build without warnings
pnpm dev              # both servers come up
curl http://localhost:4000/api/health
# walk the docs/DEMO.md script end-to-end
```

The E2E test suite (Playwright) is in the [deferred list](#roadmap--deferred-work).

---

## Project Management

The live task tracker is [TODO.md](./TODO.md). It lists every task, owner,
acceptance criterion, risk, and deferred item.

**Branching:** feature branches → PR into `develop` → squash-merge. Tag
`v0.1.0` from `develop`, then merge to `main` at submission.

**Commits:** [Conventional Commits](https://www.conventionalcommits.org/)
(`feat(web): ...`, `fix(api): ...`, `docs: ...`, `chore: ...`).

---

## Contributing

This repo was built in a 14-day competition window. Until submission, the team
works on `develop`. After submission, we welcome issues and PRs.

If you find a clinical inaccuracy in `packages/shared/src/medical-knowledge.ts`,
please open an issue tagged `medical-accuracy` — those go to the top of the
queue.

---

## Acknowledgements

Built on the shoulders of:

- **OpenRouter** — multi-model LLM gateway.
- **Anthropic Claude, OpenAI GPT-4o, Google Gemini, Meta Llama, DeepSeek** —
  the models doing the actual reasoning.
- **OpenAI Whisper** — multilingual speech recognition.
- **WHO IMCI guidelines, MSF Clinical Guidelines, CDC summaries** — sources
  behind the seed knowledge base.
- The open-source maintainers of Vite, React, Tailwind, Express, Zod, Zustand,
  react-router, Workbox, lucide-react, and pnpm.

Competitive research informed by 2026 analyses of OpenEvidence, Glass Health,
Hippocratic AI, Vera Health, and MedRAG.

---

## License

MIT. See [LICENSE](./LICENSE) (to be added).

---

<p align="center"><i>Built for the next billion patients.</i></p>
