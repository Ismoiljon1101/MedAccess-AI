# System Architecture — MedAccess AI v0.1.0

```mermaid
graph TB
    subgraph CLIENT["Client Layer"]
        PWA["PWA (installable)"]
        BROWSER["Browser"]
        MOBILE["Mobile (future: React Native)"]
    end

    subgraph WEB["apps/web · React 18 + Vite + TS"]
        ROUTER["react-router v6"]
        PAGES["Pages: Home / Interview / Symptoms / Reports / Triage"]
        COMP["Components: Layout / Sidebar / Header / VoiceButton / TriageBadge / ProbabilityBar / CitationList"]
        STATE["Zustand store (lang, model, prefs)"]
        APICLIENT["lib/api.ts (typed client + SSE)"]
        SW["Service Worker (Workbox)"]
    end

    subgraph SHARED["packages/shared"]
        SCHEMAS["Zod schemas"]
        PROMPTS["System prompts"]
        KB["Seed RAG knowledge (15 docs)"]
        TYPES["TS types"]
    end

    subgraph API["apps/api · Express + TS"]
        MIDDLEWARE["Middleware: cors / json / multer / error"]
        AUTH_FUTURE["AuthN/AuthZ (FUTURE: JWT + RBAC)"]
        ROUTES["Routes: /chat /symptoms /triage /reports /transcribe /health"]
        SERVICES["Services: llm.ts / vision.ts / transcribe.ts / rag.ts"]
        SESSIONS["In-memory sessions (TTL sweep)"]
    end

    subgraph EXTERNAL["External Providers"]
        OPENROUTER["OpenRouter Gateway"]
        WHISPER["OpenAI Whisper (optional)"]
    end

    subgraph MODELS["LLM Models (via OpenRouter)"]
        CLAUDE["Claude Sonnet 4.5"]
        GPT["GPT-4o / GPT-4o-mini"]
        GEMINI["Gemini 2.0 Flash"]
        LLAMA["Llama 3.3 70B"]
        DEEPSEEK["DeepSeek"]
    end

    subgraph FUTURE["Persistence Layer (FUTURE)"]
        POSTGRES["PostgreSQL (users, patients, encounters, audit)"]
        REDIS["Redis (sessions, rate limit)"]
        PGVECTOR["pgvector (RAG embeddings)"]
        S3["S3/MinIO (image uploads)"]
        AUDIT["Audit log stream"]
    end

    PWA --> BROWSER
    BROWSER --> ROUTER
    MOBILE -.future.-> APICLIENT
    ROUTER --> PAGES
    PAGES --> COMP
    PAGES --> STATE
    PAGES --> APICLIENT
    SW -.caches.-> COMP

    APICLIENT -->|HTTPS /api/*| MIDDLEWARE
    MIDDLEWARE --> AUTH_FUTURE
    AUTH_FUTURE --> ROUTES
    ROUTES --> SERVICES
    SERVICES --> SESSIONS

    SHARED --> WEB
    SHARED --> API

    SERVICES -->|chat/vision| OPENROUTER
    SERVICES -->|STT| WHISPER
    OPENROUTER --> CLAUDE
    OPENROUTER --> GPT
    OPENROUTER --> GEMINI
    OPENROUTER --> LLAMA
    OPENROUTER --> DEEPSEEK

    SESSIONS -.migrate.-> REDIS
    ROUTES -.persist.-> POSTGRES
    SERVICES -.upgrade RAG.-> PGVECTOR
    ROUTES -.store images.-> S3
    AUTH_FUTURE -.emit.-> AUDIT
    AUDIT -.write.-> POSTGRES

    classDef current fill:#1e3a3a,stroke:#22b8a3,color:#fff
    classDef future fill:#3a2d1e,stroke:#d97706,color:#fff,stroke-dasharray: 5 5
    class WEB,API,SHARED,EXTERNAL,MODELS,CLIENT current
    class FUTURE,AUTH_FUTURE future
```

## Layers Explained

### 1. Client (PWA + Browser)
- **Vite dev server** on `:5173` (dev) or static build (prod)
- **Service Worker** (Workbox) caches shell assets; API calls always hit network
- **Installable on Android/iOS** as standalone app icon
- Falls back gracefully under spotty connectivity (cached pages visible, API calls queue)

### 2. Frontend (apps/web)
- **React 18** + **react-router v6** for SPA routing
- **Zustand** store persists `language` + `model` prefs to localStorage
- **Tailwind CSS** (dark theme, `ink` + `accent` palette)
- **5 pages:** Home (nav cards) + Interview (chat) + Symptoms (ranking) + Reports (vision) + Triage (emergency)
- **Typed API client** in `lib/api.ts` — every endpoint call is type-safe (Zod inferred)
- **VoiceButton** on free-text inputs — routes to Whisper (if key set) or browser Web Speech API

### 3. Shared Package (packages/shared)
- **Single source of truth** for API contracts (Zod schemas)
- **System prompts** for every model call (interview, symptom analysis, vision, triage)
- **Seed RAG knowledge:** 15 curated clinical docs (malaria, dengue, TB, ACS, stroke, IMCI, sepsis, etc.)
- **TS types** inferred from Zod, used by both frontend + API

### 4. Backend API (apps/api)
- **Express + TS** on `:4000` (proxied to `:5173/api/*` in dev)
- **5 endpoint families:**
  - `POST /api/chat` + `/api/chat/stream` (SSE) — interview + history
  - `POST /api/symptoms` — symptom → differential ranking
  - `POST /api/triage` — case + vitals → Manchester triage
  - `POST /api/reports/analyze` — multipart image → vision analysis
  - `POST /api/transcribe` — multipart audio → Whisper STT (optional)
- **Services:**
  - `llm.ts` — OpenRouter client (OpenAI SDK with baseURL swap)
  - `vision.ts` — multimodal image → structured JSON via chat.completions with `response_format: json_object`
  - `transcribe.ts` — OpenAI Whisper STT (or browser Web Speech fallback)
  - `rag.ts` — BM25 keyword retrieval over seed docs
- **Middleware:** cors, json body parser, multer file upload, error handler
- **Sessions:** In-memory `Map<sessionId, { messages[], createdAt, updatedAt }>` with TTL sweep every 5 min

### 5. External Services
- **OpenRouter** (gateway to 50+ LLM providers)
  - Default: `anthropic/claude-sonnet-4.5` (top on HealthBench 2026)
  - Fast fallbacks: `openai/gpt-4o-mini`, `google/gemini-2.0-flash`
  - One key, zero migration cost (OpenAI SDK compatible)
- **OpenAI Whisper** (optional, server-side STT)
  - Requires separate `OPENAI_API_KEY`
  - Browser Web Speech API fallback (zero-key, works in Chrome/Edge)

### 6. Persistence (MVP: None; Future)
- **PostgreSQL:** Users, patients, encounters, audit log, RAG docs
- **Redis:** Sessions (replace in-memory), rate limiting, caching
- **pgvector:** Embedding-based RAG (when corpus > ~200 docs)
- **S3/MinIO:** Image uploads (currently in-memory)

## Data Flow: Symptom Analysis Example

```
1. User inputs symptoms + patient context in /symptoms page
2. Frontend calls lib/api.ts → POST /api/symptoms
3. API validates with SymptomsRequestSchema (Zod)
4. RAG retrieves top 3–4 docs matching symptom keywords (BM25)
5. LLM (OpenRouter) runs system prompt + retrieval results + symptoms → JSON
6. safeParseJson() repairs garbled JSON; best-effort Zod validate
7. Response: { differentials[], urgency, recommendedNextSteps, disclaimer }
8. Frontend renders ProbabilityBar[] (sorted desc), urgency badge, warnings
9. CitationList shows which RAG docs informed the answer
```

## Scaling Plan (Post-MVP)

| Milestone | Trigger | Work |
|---|---|---|
| **Auth v1** | Day after submission | JWT + local clinic auth, no SAML yet |
| **DB v1** | Week 2 | Postgres + Prisma, migrate sessions → Redis |
| **RAG v2** | Week 4 (~200 seed docs ingested) | Add pgvector embeddings, hybrid BM25+semantic |
| **Multi-tenant** | Week 6 | Clinic isolation, per-clinic settings, auth/RBAC |
| **Compliance** | Month 2 | HIPAA/GDPR audit, data retention, encrypted backups |
| **Native (iOS/Android)** | If funding | React Native shares 70%+ code with web |

## Definitions

- **MVP (v0.1.0):** Stateless API, in-memory sessions, no auth, 15-doc RAG, open to all
- **v0.2.0:** Auth + Postgres, multi-clinic RBAC, persistent patient records
- **v1.0.0:** Production-ready: compliance, large corpus RAG, analytics, mobile native
