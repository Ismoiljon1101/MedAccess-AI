# Ismail — CTO / Lead Engineer

> **Role:** Head of engineering. Owns architecture, design patterns, integrations, and the cross-team review queue.
> **Identity check:** confirm "you are Ismail" before proceeding.

---

## Lane (what Ismail personally drives)

- **Architecture** — monorepo layout, package boundaries, route mounting, middleware order
- **Design patterns** — schemas-first contracts, Zod everywhere, fire-and-forget MongoDB
- **Integrations** — OpenRouter gateway, LiveKit voice, MongoDB, the new Python image-ml sidecar
- **System prompts** (clinical safety floor lives here)
- **Cross-team review** — every architectural file change in [`CLAUDE.md`](../../CLAUDE.md) §4 requires Ismail's sign-off
- **AI deep-dive** — learning every model end to end (multimodal, RAG, image ML pipeline). Pair-program with Temirlan on the Python service to internalize it.

## Files Ismail owns end-to-end

Anyone else editing these must ping Ismail first:

- `apps/api/src/server.ts`
- `apps/api/src/services/llm.ts` · `rag.ts` · `vision.ts`
- `packages/shared/src/schemas.ts` · `prompts.ts`
- `packages/db/src/models/**`
- `services/image-ml/main.py` (interface contract — Temirlan owns the models inside)
- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `.env.example`

## Current sprint priorities (in order)

### ✅ Done
- ✅ Vision pipeline: local models only — no Gemini, no cloud vision
- ✅ TorchXRayVision DenseNet121 running (X-ray, 18 pathologies, Apache 2.0)
- ✅ YOLOv8s malaria model running (99.1% mAP50, MIT)
- ✅ Image analysis → auto-triggers Find Care CTA when findings serious
- ✅ AI image report attached to referral — doctor sees findings on Patient Queue
- ✅ Patient-friendly language in all image analysis responses
- ✅ FindCare GPS race condition fixed (waits for coords before loading)
- ✅ Care loop wired end-to-end: image → local model → CTA → book → clinic sees AI report

### 🔴 Blockers (do first)
1. **Skin model ONNX conversion** — on x86 Windows, Mac, or Colab:
   ```bash
   pip install tensorflow tf2onnx
   python services/image-ml/convert_skin_to_onnx.py
   # Copy output: services/image-ml/models/skin-xception.onnx → ARM machine
   # Restart sidecar → Xception 92% skin detection live
   ```
   **Note:** ARM64 Windows has no TF wheels. Must run on other machine.
   Mac (M-series) works: `pip install tensorflow-macos tf2onnx`

2. **Fix TypeScript errors** — `pnpm typecheck` has errors in `chat.ts` + `sessions.ts` (Mongoose `createdAt`/`updatedAt` typing).

### 📋 Next up
3. **Frontend design pass** — both apps look generic. Use `/frontend-design` skill on patient Chat, FindCare, clinic Dashboard.
4. **`pnpm typecheck` clean** on all workspaces before `v0.1.0` tag.
5. **Tag `v0.1.0`** when DoD green.

### 🤔 Decision needed
- **Skin model choice** — see `TODO.md §0.6` and `research/00-overview.md §2b`. Xception 92% (current) vs EfficientNet-B0 95.5% vs Roboflow CC BY 4.0 API. Decide before Temirlan trains.

## Escalation

You're the top of the chain. You don't escalate — you answer. If you're uncertain about a clinical-safety decision, the rule is: **default to the more cautious option** and add a note in the PR for clinical review post-MVP.

## Working style

- Normal mode (full sentences). You're the project narrator — others read your commit messages and PR descriptions.
- Commits use the standard Conventional Commits format.
- Author: `ismoiljon1101 / ismoiljonedu@gmail.com`. No Co-Authored-By.

## Agent skills available

All skills are available to you. Key workflows:

- **Building/reviewing React UI** → `/frontend-design` for new pages, `/vercel-react-best-practices` for perf review
- **Vite config / build issues** → `/vite`
- **PWA manifest / service worker** → `/pwa-development`
- **Python sidecar work** → `/fastapi` for `services/image-ml/` patterns
- **MongoDB schema design** → `/mongodb`
- **Reviewing a PR** → `/code-review` (use `high` or `max` for architectural changes)
- **Testing a feature visually** → `/webapp-testing` (Playwright-based) or `/verify`
- **Finding new skills** → `/find-skills`

## How to ask the agent

When you (Ismail) start a session, the agent will say "Are you Ismail?" — confirm. Then you can give high-level direction ("design the image-ml interface", "review this PR") and the agent will not gate you on architectural edits. You have full repo access.
