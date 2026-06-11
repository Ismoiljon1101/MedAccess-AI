# MedAccess AI — Demo Runbook

> How the whole system fits together and exactly how to show it live. Read this before any demo.

---

## 1 · What the system is (30-second mental model)

Three apps + one AI sidecar, all local:

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│ Patient PWA │ ──► │  API (Express)   │ ──► │ image-ml sidecar   │
│  :5174      │     │  :4000           │     │ (FastAPI) :5001    │
│ chat/voice/ │ ◄── │  LLM gateway +   │ ◄── │ specialist vision  │
│ image/book  │     │  Mongo + RAG     │     │ models (local)     │
└─────────────┘     └──────────────────┘     └────────────────────┘
        ▲                    │
        │                    ▼
┌─────────────┐        ┌──────────┐
│ Clinic app  │ ◄───── │ MongoDB  │   doctor sees the booked
│  :5173      │        └──────────┘   appointment + AI report
└─────────────┘
```

**The core value loop:** patient talks to the AI agent (text or voice) → agent asks questions, optionally analyzes an uploaded medical image with a **local specialist model** → agent recommends care → **books an appointment conversationally** against a real doctor's open slots → the doctor sees it on their Patient Queue with the full AI summary.

**Design rule (don't break on stage):** the specialist vision model looks at the pixels and returns findings; the LLM only ever sees **text** and explains it. Images never go to a cloud LLM.

---

## 2 · The "AI Activator" — how image analysis works

`services/image-ml/` is the local inference server ("activator"). On boot it auto-downloads and serves specialist models, then exposes `POST /analyze`:

| Modality | Model | Runtime | Notes |
|---|---|---|---|
| X-ray | TorchXRayVision DenseNet121 (18 pathologies) | `torch` | auto-fetches weights on first call |
| Skin | ConvNeXt-Base HAM10000 (7-class) | `torch` + `timm` | 334 MB, auto-pulled on boot |
| Eye | Diabetic-retinopathy classifier | `onnxruntime` | ONNX, auto-pulled on boot |
| Malaria | YOLOv8s | `ultralytics` | weights already in `models/` |

Pipeline: `image → API → sidecar specialist model → findings (text) → LLM explains in plain language → patient`. See `apps/api/src/services/vision.ts`.

### ⚠️ ARM64 machines (important)
On ARM64 Windows: `torch`, `onnxruntime`, `ultralytics` install fine — but **TensorFlow does not**, and the legacy Xception skin model is TF, so **skin won't run on ARM**. The current skin model is ConvNeXt (`torch`+`timm`), which does work — but needs `timm` installed and the 334 MB checkpoint pulled (needs internet on first boot).

**For a demo where ALL modalities must work:** run the sidecar on a non-ARM machine (x86 Windows/Linux/Mac) and point the apps at it:

```bash
# on the capable machine, after starting the sidecar:
#   set IMAGE_ML_URL in the API's .env to that machine's address
IMAGE_ML_URL=http://<sidecar-host>:5001
```

The ARM laptop can still run the UI; only the sidecar needs to live where all model runtimes install.

---

## 3 · One-time setup

### 3.1 Node workspace (root)
```bash
pnpm install          # pnpm only — never npm
cp .env.example .env  # then fill the keys below
```

Minimum env for a full demo (in `.env`):
```
MONGODB_URI=...                 # required — bookings/doctors/patients persist here
OPENROUTER_API_KEY=...          # required — the chat/agent LLM
IMAGE_ML_URL=http://localhost:5001   # the sidecar (or remote host on ARM)
OPENAI_API_KEY=...              # optional — Whisper STT for voice (browser STT is the fallback)
```

### 3.2 image-ml sidecar (Python)
```bash
cd services/image-ml
python -m venv .venv
.venv/Scripts/activate          # Windows;  source .venv/bin/activate on mac/linux
pip install -r requirements.txt
# first run downloads the specialist models (needs internet); cached after
python -m uvicorn main:app --host 127.0.0.1 --port 5001
```
- `SKIP_MODEL_DOWNLOADS=1` for air-gapped runs (modalities without weights return `skipped`).
- `GET /healthz` reports each model's status + on-disk size — check this before demoing.
- `POST /admin/pull-models` re-pulls manually.

---

## 4 · Starting the stack for a demo

From the repo root (starts API + both apps in parallel):
```bash
pnpm dev
```
Then start the sidecar separately (section 3.2). Ports:

| Service | URL |
|---|---|
| Patient PWA | http://localhost:5174 |
| Clinic app | http://localhost:5173 |
| API | http://localhost:4000 |
| image-ml sidecar | http://localhost:5001 |

**Pre-flight checklist (run through this before walking on stage):**
1. `curl http://localhost:4000/api/health` → `ok`, `openrouter: true`.
2. `curl http://localhost:5001/healthz` → models loaded (or remote sidecar reachable).
3. `curl "http://localhost:4000/api/facilities"` → your clinic + doctor show up (the booking target).
4. **Sign the patient in** with a phone number — bookings require an identity (a "Guest" cannot book; the server needs a `patientId`).
5. In the clinic app, log in as the **Doctor** for that clinic so the Patient Queue is open on a second screen/tab.

---

## 5 · The demo script (the path that always works)

Two windows side by side: **Patient PWA** (left), **Clinic app → Patient Queue** (right).

1. **Sign in** on the patient app with a name + phone. (Identity is now established.)
2. **Talk to the agent** — type or hold the mic (voice). Describe a symptom, e.g. a dark, changing skin spot. The agent asks focused follow-up questions.
3. **(Optional) Upload a medical image** — for the live "AI on pixels" moment, an **X-ray** is the safest bet (works on any machine with `torch`). The sidecar returns findings; the agent explains them in plain language and flags if care is needed.
4. **Conversational booking** — when care is warranted, the agent says e.g. *"Dr. lkjsdf at Seoul clinic has an opening on 2026-06-12 at 09:00 — shall I book it?"* (that's a **real** open slot, injected from the database — the agent never invents times). Say **"yes"**. The agent replies *"All set — I've booked that for you."* and the appointment is created silently.
5. **Switch to the clinic window** — the booking appears on the **Patient Queue** within ~30 s (auto-refresh) with the patient profile, urgency, and the **full AI conversation summary** (and image findings, if any). The doctor clicks **Confirm Appointment**.

That loop — *talk → (image) → agent books a real slot → doctor receives it with the AI report* — is the spine of the product and is verified working end-to-end.

---

## 6 · How each feature works (for Q&A)

- **Text chat / agent** — `apps/api/src/routes/chat.ts` streams from the LLM (`services/llm.ts`) with RAG context (`services/rag.ts`). The system prompt (`packages/shared/src/prompts.ts`) is injected each turn with the matched doctors **and their real open slots**.
- **Conversational booking** — the prompt instructs the agent to propose only injected real slots and, on confirmation, emit a hidden `<<BOOK:{...date,time}>>` marker. The patient app (`apps/patient/src/pages/Chat.tsx → autoBook`) strips the marker from view and silently `POST`s `/api/appointments` with the full conversation summary attached. Slots come from `getUpcomingSlots` (09:00–17:00, Sundays closed, booked times removed).
- **Voice** — `apps/patient/src/pages/VoiceMode.tsx`: **push-to-talk** (hold to record, release to send). Audio → Whisper STT (server, `OPENAI_API_KEY`) with browser Web Speech as fallback → chat LLM → browser TTS speaks the reply. No realtime media server (LiveKit was removed).
- **Image analysis** — section 2. `apps/api/src/services/vision.ts` calls the sidecar, then has the LLM translate findings into patient-friendly language.
- **Doctor queue** — `apps/clinic/src/pages/Patients.tsx`: polls `/api/appointments` every 30 s, shows patient profile + agent summary + image findings, lets the doctor confirm/decline.

---

## 7 · Troubleshooting (on the day)

| Symptom | Cause | Fix |
|---|---|---|
| "Cannot reach local ML sidecar at :5001" | sidecar not running / wrong `IMAGE_ML_URL` | start the sidecar (3.2) or point `IMAGE_ML_URL` at the host running it |
| Image returns `skipped` | model not pulled / runtime missing (TF on ARM) | check `/healthz`; run the sidecar on a non-ARM box (section 2) |
| Booking silently does nothing / errors | patient is a **Guest** (no phone) | sign the patient in first — the server requires a `patientId` |
| Agent proposes a time but won't book | LLM didn't emit the marker / slot was taken | rephrase "yes, book it"; the in-chat picker appears as a fallback |
| Voice doesn't transcribe | no `OPENAI_API_KEY` | browser Web Speech fallback covers English; set the key for best accuracy |
| Doctor doesn't see the booking | wrong clinic logged in / >30 s | confirm the doctor's clinic matches the booked one; hit Refresh |

---

## 8 · Honest limits (say these if asked)

- Skin/eye checkpoints are **community models** — the pipeline is proven; formal accuracy evaluation is pending (Temirlan). Not FDA/CE cleared.
- The agent is a triage/booking assistant, **not a diagnostic device** — it never claims certainty and always recommends in-person evaluation for serious concerns.
- Bookings, doctors, and patients are real records in MongoDB; there is no fake seed data.
