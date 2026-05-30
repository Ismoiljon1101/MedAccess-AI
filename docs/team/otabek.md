# Otabek — TypeScript Feature Shipper

> **Role:** Ships features cleanly. Strong on TS / React / Node.
> **Identity check:** confirm "you are Otabek" before proceeding.

---

## Lane

Front-of-the-line for new user-visible features and refinements across both portals. Otabek closes loops — takes a half-done feature, polishes it, makes it real.

Otabek edits freely:
- `apps/clinic/src/**` (provider portal — pages, components, lib, store)
- `apps/patient/src/**` (patient portal — pages, components, lib, store, except the MA Agent identity prompt logic)
- Tailwind config, Vite config, PWA manifest
- Tests (when we add them)

Otabek pings Ismail before touching:
- `apps/api/src/routes/**` (only for *additive* endpoints — breaking changes always need Ismail)
- `packages/shared/src/schemas.ts` (cross-boundary)
- `packages/db/src/models/**`
- `services/image-ml/**` (Temirlan's lane)

## Current sprint priorities

1. **Image thumbnail in chat** — `apps/patient/src/pages/Chat.tsx` currently shows `[Uploaded: filename]` as the user message. Render a 200×200 thumbnail `<img>` next to the filename. Use `URL.createObjectURL(file)` for instant preview; revoke on unmount.
2. **Connect-to-Care CTA polish** — the heuristic in `Chat.tsx detectClinicalSnapshot()` is keyword-based and a bit noisy. Add a "Dismiss" X to the CTA card so patients can hide it if false-positive.
3. **Patients queue real-time** — `apps/clinic/src/pages/Patients.tsx` currently fetches once. Add 30-second polling (or `EventSource` if we add SSE later) so new referrals appear without manual refresh.
4. **Vision model upgrade smoke test** — after Ismail flips `OPENROUTER_VISION_MODEL=anthropic/claude-sonnet-4-5`, walk through Patient Chat → upload skin photo → upload chest X-ray. Compare outputs before/after. Document in `docs/qa/issues.md` (vision-upgrade verification).
5. **Loading / empty / error states** — go through every page in patient + clinic and add skeleton loaders + empty states + error toasts where missing. See `TODO.md` Day 13.
6. **PWA verification** — Lighthouse audit ≥ 90 on both portals. Fix whatever drops the score.

## Working style

- Conventional Commits. Squash-merge feature branches into `develop`.
- Branch names: `feat/chat-image-thumb`, `fix/patients-poll`, `polish/empty-states`.
- Open a PR even for one-line changes when they touch shared files — Ismail reviews quickly.
- For pure UI changes within one component, commit directly to `develop`.

## Escalation

- Want to add a new dependency → check it's small (<50kb gzipped), then add to `TODO.md` Bugs/Issues with one-line justification, then `pnpm add`. Ping Ismail if it's a heavy dep.
- Schema or DB change needed → open an issue / DM Ismail. Don't try to work around.
- Behavior unclear → check `README.md` Modules section first, then ask Ismail.

## Agent skills available

Use these skills to ship faster and cleaner:

| Task | Skill | Example |
|---|---|---|
| Build a new page/component | `/frontend-design` | "Build a prescription detail modal" |
| React performance patterns | `/vercel-react-best-practices` | "Optimize the chat message list rendering" |
| Vite config or build issue | `/vite` | "Fix HMR not working on patient app" |
| PWA audit / manifest fix | `/pwa-development` | "Fix Lighthouse PWA score" |
| Test a feature in browser | `/webapp-testing` | "Test the booking flow end-to-end" |
| Verify a fix works | `/verify` | "Verify the polling fix on Patients page" |

**Workflow:** When building UI, start with `/frontend-design` for the visual, then `/vercel-react-best-practices` to optimize. After shipping, `/webapp-testing` to verify.

## How to ask the agent

You're trusted to ship. Agent gates you (soft) on architectural files but otherwise gets out of your way. Tell it: "I'm Otabek, working on [feature]." and go.
