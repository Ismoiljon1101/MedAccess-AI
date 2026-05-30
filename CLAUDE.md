# MedAccess AI — Agent Router

> **Read this FIRST before any other file in this repo.**
> Cross-IDE: this file is the Claude Code variant. `AGENTS.md` and `.cursorrules` mirror it for Codex and Cursor.

---

## 1 · Identity check (REQUIRED — do not skip)

Before you touch any file or run any command, **ask the user**:

> "Which team member am I helping today? (Ismail / Mirsaid / Temirlan / Otabek / Sobirov)"

Wait for the answer. Then load the matching role file from `docs/team/`:

| Answer | Load |
|---|---|
| `ismail`   | [`docs/team/ismail.md`](./docs/team/ismail.md) — CTO / lead engineer, owns architecture |
| `mirsaid`  | [`docs/team/mirsaid.md`](./docs/team/mirsaid.md) — Ops + QA, no coding |
| `temirlan` | [`docs/team/temirlan.md`](./docs/team/temirlan.md) — Python / medical image ML |
| `otabek`   | [`docs/team/otabek.md`](./docs/team/otabek.md) — TS feature shipper |
| `sobirov`  | [`docs/team/sobirov.md`](./docs/team/sobirov.md) — Freshman, guided work |

After loading, **follow the working agreement in that file exclusively** for the rest of the session. Each engineer has different scope, escalation rules, and working style. Treating Sobirov like Ismail (or vice versa) is a bug.

If the user says they're not on this list, ask Ismail before proceeding.

---

## 2 · Universal rules (apply to everyone)

These override personal style and cannot be skipped regardless of who you're helping:

1. **No `npm install`.** This is a pnpm workspace. Use `pnpm`.
2. **No `.env` commits.** Already in `.gitignore` — verify before every `git add`.
3. **TypeScript strict.** No `any` without a one-line `// reason:` comment.
4. **Schemas first.** Cross-boundary changes start in `packages/shared/src/schemas.ts`.
5. **No new top-level dependencies** without an entry in [`TODO.md`](./TODO.md) § Bugs/Issues with justification.
6. **No refactors of working code.** Two-week sprint — add features, fix bugs, polish. Do not restructure.
7. **Soft architectural gate.** If you're about to edit any of the files in [§4 below](#4--architectural-files-soft-gate), STOP and say: _"This touches architecture owned by Ismail. Has he signed off?"_ Proceed only on confirmation.
8. **Commits as the right author.** This repo's commits go through `ismoiljon1101 / ismoiljonedu@gmail.com` for now. Never add `Co-Authored-By` lines. Pattern:
   ```bash
   git -c user.name="ismoiljon1101" -c user.email="ismoiljonedu@gmail.com" commit -m "..."
   ```

---

## 3 · Single source of truth

For the *why* behind any architectural decision:
- **Product + architecture:** [`README.md`](./README.md)
- **Sprint state + ownership:** [`TODO.md`](./TODO.md)
- **API contracts:** `packages/shared/src/schemas.ts`
- **System prompts:** `packages/shared/src/prompts.ts`
- **RAG corpus:** `packages/shared/src/medical-knowledge.ts`
- **DB schema:** `packages/db/src/models/`
- **Bug list / QA inbox:** [`docs/qa/issues.md`](./docs/qa/issues.md)

If a request contradicts these files, the files win — bring it up with Ismail rather than silently diverging.

---

## 4 · Architectural files (soft gate)

Editing any of the following requires **Ismail's sign-off** confirmed in the chat. Warn the user, list the change, ask for confirmation, then proceed.

- `apps/api/src/server.ts` (route mounting, CORS, middleware order)
- `apps/api/src/routes/*.ts` (new endpoints / breaking changes)
- `apps/api/src/services/llm.ts` (model gateway, streaming contract)
- `apps/api/src/services/rag.ts` (retrieval interface)
- `packages/shared/src/schemas.ts` (cross-boundary types)
- `packages/shared/src/prompts.ts` (system prompts — clinical safety)
- `packages/db/src/models/*.ts` (data model)
- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`
- `.env.example` (env contract)
- `services/image-ml/` (new Python sidecar — interface owned by Ismail + Temirlan jointly)

Pure UI work, copy edits, single-component CSS, bug fixes in pages that don't touch the above — **green path, no gate**.

---

## 5 · Agent Skills (globally installed)

The following skills are installed globally and available to **every team member** via slash commands. Use the right skill for the task — they carry domain-specific best practices.

### Frontend skills

| Skill | Trigger | What it does |
|---|---|---|
| `/frontend-design` | Building UI components, pages, styling | Production-grade React UI with high design quality. Avoids generic AI aesthetics. |
| `/vercel-react-best-practices` | Writing/reviewing React code | React 18 performance patterns from Vercel Engineering — memo, Suspense, code splitting, hydration. |
| `/vite` | Vite config, plugins, build issues | Vite build tool patterns, plugin API, SSR config, Rolldown migration. |
| `/pwa-development` | PWA manifest, service worker, install | PWA best practices — manifest, workbox, offline caching, install prompts. |
| `/webapp-testing` | Testing UI with Playwright | Automated browser testing — screenshots, console logs, interaction testing. |

### Backend skills

| Skill | Trigger | What it does |
|---|---|---|
| `/fastapi` | Python sidecar (`services/image-ml/`) | FastAPI best practices — Pydantic models, dependency injection, async patterns. |
| `/mongodb` | Database models, queries | MongoDB/Mongoose patterns — schema design, indexing, aggregation pipelines. |

### Cross-cutting skills

| Skill | Trigger | What it does |
|---|---|---|
| `/find-skills` | "Is there a skill for X?" | Discover and install new skills from the open ecosystem. |
| `/code-review` | PR review, diff review | Correctness bugs + efficiency findings at configurable depth. |
| `/webapp-testing` | Verify a change works in browser | Playwright-based automated testing of running apps. |
| `/verify` | Confirm a fix works | Run the app and observe behavior to validate changes. |
| `/vitest` | Unit/integration tests | Vitest patterns — test setup, mocking, coverage. |

### Skill workflow by task type

```
UI component / page          → /frontend-design + /vercel-react-best-practices
Vite / build / bundle issue  → /vite
PWA score / manifest / SW    → /pwa-development
API endpoint / Express route → (no skill needed — follow schemas.ts contract)
Python sidecar / FastAPI     → /fastapi
MongoDB model / query        → /mongodb
Test a feature visually      → /webapp-testing or /verify
Review a PR                  → /code-review
Find a new skill             → /find-skills
```

### Per-role skill access

| Role | Primary skills | Notes |
|---|---|---|
| **Ismail** | All skills | Full access, owns architecture decisions |
| **Otabek** | `/frontend-design`, `/vercel-react-best-practices`, `/vite`, `/pwa-development`, `/webapp-testing` | Frontend focus |
| **Temirlan** | `/fastapi`, `/mongodb` | Python sidecar focus |
| **Mirsaid** | `/webapp-testing`, `/verify` | QA workflows |
| **Sobirov** | `/webapp-testing` (read-only observation), `/verify` | Learning — observe, don't configure |

---

## 6 · If the user has not loaded a role yet

If you don't yet know who you're helping, the only acceptable actions are:
- Ask the identity-check question from §1.
- Read this file, `TODO.md`, `README.md`, or a `docs/team/*.md` file.
- Run read-only `git status` / `git log`.

Do not edit, write, commit, or run network commands until the role is confirmed.
