# MedAccess AI — Task Tracker (Updated: 2026-05-28)

> **Mission:** AI Doctor Copilot for rural and underserved areas — multilingual,
> voice-first, multimodal, grounded in clinical references.
>
> **Deadline:** 2026-06-09.  **Branch:** feature → `develop` → `main`.
> **Commits:** always as `ismoiljon1101 / ismoiljonedu@gmail.com`. No Co-Authored-By.

---

## 0 · STATUS DASHBOARD

| Area | Status | Notes |
|---|---|---|
| Monorepo scaffold (pnpm, TS strict, Vite, Tailwind) | ✅ Done | |
| `packages/shared` — schemas, prompts, 31 RAG docs | ✅ Done | Expanded from 15 → 31 |
| `apps/api` — 7 routes | ✅ Done | chat, symptoms, triage, reports, transcribe, voice, health |
| `apps/clinic` — 5 pages | ✅ Done | Home, Interview, Symptoms, Reports, Triage |
| `apps/patient` — full PWA shell | ✅ Done | 5-tab nav, header, disclaimer |
| MA Agent identity (hides model, identifies as MA Agent) | ✅ Done | |
| Chat with streaming SSE | ✅ Done | |
| RAG (BM25, 31 docs, citations in UI) | ✅ Done | Both portals show citation chips |
| Medical image analysis — inline in patient chat | ✅ Done | Gemini Flash vision |
| Medical image analysis — clinic Reports page | ✅ Done | |
| Voice input — Web Speech API (no key needed) | ✅ Done | |
| Full-screen voice mode with LiveKit | ✅ Done | Standalone fallback works |
| Session history + resume (`?s=<id>`) | ✅ Done | |
| MongoDB persistence (fire-and-forget) | ✅ Done | Graceful fallback if DB down |
| Find Care page | ✅ Seed data | Real GPS + clinic DB not built yet |
| My Records page | ✅ Done | Zustand localStorage |
| Emergency triage | ✅ Done | Manchester colors |
| Settings (language, font size, voice) | ✅ Done | |
| **Patient → Clinic report handoff** | ❌ NOT BUILT | Biggest open gap |
| **Clinic booking + doctor availability** | ❌ NOT BUILT | Core goal |
| **Clinic patient queue (incoming referrals)** | ❌ NOT BUILT | Clinic portal missing |
| DICOM / PDF medical file support | ❌ Deferred | Post-MVP |
| Screenshots + DEMO.md | ❌ Not done | Needed for submission |
| `pnpm typecheck` passing all workspaces | ⚠️ Not verified | Run before submission |
| PWA Lighthouse ≥ 90 | ⚠️ Not verified | Run before submission |
| CORS allows both :5173 and :5174/:5175 | ⚠️ Check | May be broken |

---

## 1 · MA AGENT — CURRENT TRAITS

### What it CAN do now

| # | Capability | Detail |
|---|---|---|
| 1 | **Structured diagnostic interview** | One focused question at a time: chief complaint → onset/duration → associated symptoms → history → red flags → Clinical Snapshot |
| 2 | **RAG-grounded answers** | BM25 over 31 clinical docs injected into every system prompt |
| 3 | **Citation chips** | Source titles shown under every AI reply in both portals |
| 4 | **Multilingual** | Mirrors user language automatically; 17 in picker |
| 5 | **Medical image analysis** | Upload X-ray/ECG/lab photo inline in chat → structured reading: imageType, findings + confidence, keyObservations, followUp |
| 6 | **Voice input** | Browser Web Speech API → text → LLM (no OPENAI_API_KEY needed) |
| 7 | **Full-screen voice mode** | Immersive overlay: Lottie avatar + waveform + TTS readback + model picker |
| 8 | **Streaming responses** | SSE token-by-token |
| 9 | **Session history + resume** | Local persist + server-side resume |
| 10 | **Emergency safety floor** | 112/911/999 always visible; chest pain / stroke / sepsis / anaphylaxis never downgraded |
| 11 | **Identity protection** | Refuses to name model/provider; always "MA Agent by MedAccess team" |
| 12 | **Clinical Snapshot** | After 5–8 turns, summarises findings and offers to triage or find care |

### What it CANNOT do yet (gaps vs ambition)

| Gap | Priority |
|---|---|
| Find nearest real clinic by GPS | 🔴 High |
| Check doctor availability | 🔴 High |
| Book appointment | 🔴 High |
| Send full patient report to clinic | 🔴 High |
| Auto-recommend specialist type ("you need a cardiologist") | 🟡 Medium |
| Auto-trigger triage after red-flag chat | 🟡 Medium |
| Show image thumbnail preview in chat bubble (shows text only) | 🟡 Medium |
| TTS auto-readback of all responses | 🟢 Low |
| Larger RAG corpus (WHO/MSF/CDC ~5k docs) | 🟡 Medium |

---

## 2 · RAG STATUS

| Item | Status |
|---|---|
| Implementation | ✅ BM25 (`apps/api/src/services/rag.ts`) |
| Corpus size | ✅ **31 documents** (was 15) |
| Topics | ✅ Malaria, dengue, TB, pneumonia (adult + IMCI child), ACS, stroke, sepsis/qSOFA, asthma, anaphylaxis, pre-eclampsia, mental health, headache red flags, dehydration, oral rehydration, UTI, appendicitis, renal colic, migraine, gastroenteritis, allergic rhinitis, back pain red flags, DVT/PE, wound infection/necrotising fasciitis, chest pain differential, fever, skin rash, COVID-19, diabetes/DKA, hypertension crisis, upper respiratory infection |
| Citations in clinic portal | ✅ Shown under every AI message |
| Citations in patient portal | ✅ Source chips under AI messages |
| Injected into system prompt | ✅ Top 3–4 hits as context |
| Embeddings | ❌ Deferred — BM25 sufficient at 31 docs |
| Large corpus | ❌ Deferred post-competition |

**RAG done for MVP?** Yes. BM25 over 31 curated clinical docs is solid for the demo. Upgrade path: one file swap in `rag.ts` to move to embeddings + pgvector.

---

## 3 · MEDICAL IMAGE READING STATUS

| Item | Status |
|---|---|
| Endpoint (`POST /api/reports/analyze`) | ✅ Working |
| Inline upload in patient chat | ✅ Image icon in input bar |
| Clinic Reports page | ✅ Working |
| Structured output | ✅ imageType, qualityNotes, keyObservations, findings (+ confidence), suggestedFollowUp, disclaimer |
| Refuses to fabricate | ✅ Prompted to say "unreadable/unknown" not guess |
| Current vision model | ⚠️ **Gemini 2.0 Flash (free)** — ~70–75% medical accuracy |
| Image preview in chat bubble | ❌ Shows `[Uploaded: filename]` text, no thumbnail |

### Vision model comparison (for accuracy upgrade)

| Model | Est. Medical Accuracy | Cost | How to use |
|---|---|---|---|
| Gemini 2.0 Flash (current) | ~70–75% | Free | Already set |
| GPT-4o | ~82–85% | ~$0.01/image | Set `OPENROUTER_VISION_MODEL=openai/gpt-4o` |
| **Claude 3.5 Sonnet** | ~88–92% | ~$0.015/image | Set `OPENROUTER_VISION_MODEL=anthropic/claude-sonnet-4-5` |
| Google MedLM-Medium | ~94% | Google Cloud only | Requires Healthcare API |
| Med-SAM / Open MONAI | ~95%+ | Self-hosted | Out of scope for MVP |

**Immediate win:** switch `.env` → `OPENROUTER_VISION_MODEL=anthropic/claude-sonnet-4-5` — same code, better reads, still via OpenRouter.

---

## 4 · README AMBITION — ARE WE ON TRACK?

| README Goal | Reality | Gap |
|---|---|---|
| Multilingual 17+ languages | ✅ Language in Settings, model mirrors language | None |
| Voice-first | ✅ Web Speech API + full-screen voice mode | No on-device offline Whisper |
| Multimodal vision | ✅ Inline image upload + structured read | Accuracy upgradeable; no thumbnail preview |
| Medical RAG | ✅ 31 docs, BM25, citations both portals | Corpus small vs 5k ambition |
| Structured interview | ✅ One question at a time, red flags, Clinical Snapshot | Good |
| Symptom analysis (ranked differentials) | ✅ Clinic portal full; patient uses chat | Patient doesn't show probability bars |
| Triage (Manchester) | ✅ Emergency tab + clinic triage page | Not auto-triggered from chat red flags |
| Report reading (images) | ✅ Inline + clinic page | Vision model accuracy; no DICOM/PDF |
| Installable PWA | ⚠️ vite-plugin-pwa installed | Not verified — run Lighthouse |
| **Patient → Clinic handoff** | ❌ **MISSING** | Biggest gap — product loop not closed |
| **Clinic booking / doctor availability** | ❌ **MISSING** | Find Care shows seed data only |
| DICOM / PDF lab parsing | ❌ | Deferred post-MVP |
| Auth + multi-tenant | ❌ | Deferred post-competition |

**Summary:** AI core is solid. The **product loop is not closed** — patient gets a diagnosis but can't reach a real clinic. That's what makes this a chatbot vs a healthcare access tool. Must fix before submission.

---

## 5 · SPRINT 2 — THIS WEEK (close the loop)

### 🔴 P1 — Patient → Clinic handoff
- [ ] `POST /api/clinics/search` — `{ lat, lng, specialty }` → returns nearest clinics
- [ ] `POST /api/clinics/:id/report` — sends chat summary + image findings to clinic queue
- [ ] `POST /api/clinics/:id/book` — stub appointment creation
- [ ] **Clinic portal patient queue** — `apps/clinic/src/pages/Patients.tsx`
  - List incoming patient referrals with MA Agent summary
  - Expand to see full transcript + image analysis
  - "Accept / Forward to Doctor" action (stub ok for demo)
- [ ] **MA Agent "Find a Clinic" CTA** — after Clinical Snapshot, show button → `/find-care` with pre-filled specialty

### 🔴 P1 — Vision model upgrade
- [ ] Set `OPENROUTER_VISION_MODEL=anthropic/claude-sonnet-4-5` in `.env`
- [ ] Test with real chest X-ray and ECG image

### 🟡 P2 — Image thumbnail in chat
- [ ] Show `<img>` preview in user message bubble when image uploaded
- [ ] Keep filename as caption

### 🟡 P2 — Auto-triage from chat
- [ ] After 6+ turns, if red-flag keywords detected, show CTA: "This sounds urgent → Check Emergency Level"
- [ ] MA Agent should name the specialist type at end of interview

### 🟡 P2 — CORS fix
- [ ] Update `.env` `CORS_ORIGIN` to allow `:5173,5174,5175` or use wildcard for dev

### 🟡 P2 — TypeScript hygiene
- [ ] `pnpm typecheck` green on all three workspaces
- [ ] Fix `any` types from rapid dev

### 🟡 P2 — PWA
- [ ] Lighthouse audit ≥ 90 on patient portal
- [ ] Test "Add to Home Screen" on Android Chrome

**Owner:** _Team lead_  · **ETA:** 1 day

---

## 6 · SPRINT 3 — WEEK 2 (polish + demo)

- [ ] `docs/DEMO.md` — exact 3-minute demo script
- [ ] 6 screenshots in `docs/screenshots/`
- [ ] 90-second fallback MP4 recording
- [ ] Loading skeletons (chat session load, image analysis)
- [ ] Error toast component
- [ ] Empty states everywhere
- [ ] Keyboard: Enter submits all forms
- [ ] All icon buttons have `aria-label`
- [ ] Test all tabs at 375px (iPhone SE)
- [ ] Pre-submission: `pnpm typecheck` + `pnpm build` + health check all green
- [ ] Tag `v0.1.0` on `develop`, PR → `main`

---

## 7 · BUGS / KNOWN ISSUES

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `llama-3.3-70b:free` rate-limited upstream (429) | 🔴 | Fixed — switched to Gemini Flash |
| 2 | No `OPENAI_API_KEY` → Whisper fails silently | 🟡 | Mitigated — Web Speech fallback |
| 3 | Image upload shows `[Uploaded: filename]` text, no preview | 🟡 | Sprint 2 |
| 4 | Find Care uses hardcoded seed data, not real GPS | 🟡 | Sprint 2 |
| 5 | CORS only allows `:5173` — patient on `:5175` may fail | 🔴 | Fix `.env` CORS_ORIGIN |
| 6 | `SpeechRecognition.onend` can fire before `onresult` on some browsers | 🟡 | Add state guard |

---

## 8 · RISK LOG

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Free LLM rate-limited during live demo | Medium | Backup models: `deepseek/deepseek-r1:free`, `llama-3.1-8b:free` |
| 2 | Patient → clinic loop not done before demo | High | Stub: "Report sent" toast + static clinic confirmation screen |
| 3 | Vision model refuses medical image | Low | Prompt framing + fallback to GPT-4o vision |
| 4 | Web Speech API not on iOS Safari | Medium | Show "type symptoms" fallback message |
| 5 | TS build fails on judge machine | Low | Pin Node ≥ 20 in README, run `pnpm typecheck` before tagging |

---

## 9 · DEFERRED (post-competition)

- HIPAA / GDPR / local compliance + BAAs with LLM providers
- Real EHR integration (HL7 / FHIR write-back)
- Embeddings + pgvector + WHO/MSF/CDC corpus (~5k docs)
- Auth, RBAC, multi-tenant clinic management
- Fine-tuned medical model (Med-PaLM / Apollo)
- DICOM upload + PDF lab parsing
- On-device Whisper.cpp for offline STT
- Audit log + clinician override workflow
- E2E test suite (Playwright)
- Cost-per-session dashboard
- Native mobile (React Native — 70%+ shared code)
