# Sobirov — Freshman Developer (Guided)

> **Role:** Learning the codebase. Ships small, well-scoped changes with heavy review.
> **Identity check:** confirm "you are Sobirov" before proceeding.

---

## Lane

Sobirov works on **small, low-risk, well-defined** changes. The goal of this sprint isn't velocity — it's building real competence on a real codebase without breaking things.

Sobirov can edit freely:
- README.md (typos, copy clarity — not architecture sections)
- `docs/screenshots/` (add screenshots, organize)
- `docs/DEMO.md` (when it exists)
- Tailwind classes (color tweaks, spacing — *within* one component)
- `aria-label` and accessibility attributes
- Empty states (string only — not the layout)
- Lucide icon swaps (Activity → Heart, etc.) when asked
- Adding `console.warn`-level logging Mirsaid asks for during QA

Sobirov does NOT touch (no exceptions):
- `apps/api/**` (entire backend)
- `packages/**` (shared, db)
- `services/image-ml/**`
- Routing (`App.tsx` route table)
- State stores (`store/app.ts`)
- API client (`lib/api.ts`)
- Anything async / `useEffect` heavy

## How to work (the agent enforces this)

**Before writing code, you must:**
1. Pick a bug from [`docs/qa/issues.md`](../qa/issues.md) marked SEV-3 or SEV-4 with `owner: unassigned`.
2. Tell the agent: "I'm Sobirov. I want to fix bug #042: [paste title]."
3. **Explain in chat** what you think the fix is, in plain English, before touching any file.
4. The agent will either:
   - Confirm your understanding and let you proceed, OR
   - Ask follow-up questions until you've understood the cause (not just the symptom).
5. Then make the change. Run `pnpm typecheck` after every save.
6. Commit only after the agent confirms it looks right.

This is slower than just "do the task." That's intentional — you're learning.

## 🎯 PRIORITY ASSIGNMENT (Ismail, do this first)

You own the **full human UI/UX + workflow review** of the whole project. A human has to
judge feel, copy, and real-world flow — the agent can't. Your master checklist is
[`docs/qa/ui-ux-review.md`](../qa/ui-ux-review.md). Two parts:

1. **OpenRouter key (gate G1).** Confirm the key Mirsaid procured is installed and live:
   `curl localhost:4000/api/health` must show `providers.openrouter: true`. If false, the
   whole AI half is dead — flag it to Ismail before testing anything AI. (Issue #003.)
2. **Page-by-page review.** Walk every screen of the patient app and the clinic app, plus
   the end-to-end workflow, on a **real phone** where you can. Mark each item PASS/FAIL.

### How the agent runs your review (it enforces this)

When you confirm "I am Sobirov", the agent will:
1. Open [`docs/qa/ui-ux-review.md`](../qa/ui-ux-review.md) and start at the first unchecked item.
2. Ask you **ONE item at a time** — never dump the whole list. It waits for your answer.
3. Require a **clear** answer: `PASS` or `FAIL`. On FAIL you must say:
   **what you did · what you expected · what actually happened · where you want it fixed.**
4. If your answer is vague ("kinda", "looks off", "sometimes"), it **asks again** until it's
   precise. It will not tick the box on a fuzzy answer.
5. On PASS it ticks `[x]`. On FAIL it marks `❌` and files a numbered bug into
   [`docs/qa/issues.md`](../qa/issues.md) (correct severity, full repro, your requested fix).
6. It keeps the scorecard at the bottom of the review doc up to date as you go.

Be strict. The point is to find every real problem, page by page, before the demo.

## Secondary tasks (after the review, or when blocked)

1. **Add screenshots** for `docs/screenshots/` listed in [`TODO.md`](../../TODO.md). Just take clean screenshots of each page.
2. **Fix issue #004** (SEV-4 doc): update TODO.md §4 endpoint list to current routes (`/api/facilities`, `/api/appointments`, `/api/maps`).
3. **Spellcheck pass** on README.md. PR with typo fixes only. Tag Ismail.
4. **Add `aria-label`** to any icon-only button still missing one. One PR per page.

## Escalation

- Stuck for more than 20 minutes → ask Otabek or Ismail. Don't burn an hour silently.
- Confused why a test fails → ping Otabek with: the command you ran, the full error, what you expected.
- Agent gates you on a file → respect it. Don't bypass. Tell the agent "I'll ask the owner first" and move on.

## How to ask the agent

The agent will **always** ask you to explain your fix in plain English first. It will **always** ask you to run `pnpm typecheck` before committing. This is not gatekeeping — it's the muscle memory you're building. Push through it; in 3 months you won't need it.

If you ever feel the agent is being too restrictive: take it up with Ismail at standup, not by switching CLAUDE.md identities.

## Agent skills available (limited scope)

| Task | Skill | How to use |
|---|---|---|
| Verify a fix works | `/verify` | After fixing a SEV-3/4 bug, run `/verify` to confirm it's actually fixed |
| Observe how testing works | `/webapp-testing` | Watch the agent run Playwright tests — good for learning what automated QA looks like |

**You do NOT use:** `/frontend-design`, `/vite`, `/fastapi`, `/mongodb`, `/code-review`. These touch code patterns beyond your current scope. Ask Otabek or Ismail if you need something from them.
