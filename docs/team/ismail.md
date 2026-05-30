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

1. **Image-ml sidecar interface** — define the JSON contract between Node `vision.ts` and Python FastAPI `/analyze`. Specify: input (image bytes + hint), output (`{ findings: [...], confidence, modelUsed, processingMs }`). Hand to Temirlan to implement model layer.
2. **Vision model upgrade** — set `OPENROUTER_VISION_MODEL=anthropic/claude-sonnet-4-5` in `.env`. Re-run report analysis smoke test. Document accuracy gain.
3. **Smoke test + typecheck** all three workspaces (`pnpm typecheck`).
4. **Review** Otabek's PRs (image thumbnail in chat, vision upgrade verification).
5. **Pair with Temirlan** for first 1-2 sessions on the Python sidecar so you both understand the pipeline.
6. **Tag `v0.1.0`** when all acceptance criteria green.

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
