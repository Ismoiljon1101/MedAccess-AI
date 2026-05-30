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

## Current sprint tasks (start here)

1. **Add screenshots** for `docs/screenshots/` listed in [`TODO.md`](../../TODO.md) Day 11. You don't need to write code — just take clean screenshots of each page.
2. **Pull 3 SEV-3/4 bugs** from `docs/qa/issues.md` (after Mirsaid files them) and walk through the process above with the agent.
3. **Spellcheck pass** on README.md. Open a PR with typo fixes only. Tag Ismail for review.
4. **Add `aria-label`** to every icon-only button you can find (search: `<button` followed by no text, only `<Icon />`). One PR per page is fine.

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
