# MedAccess AI — Agent Router (Codex / cross-tool)

> This file is the cross-tool router. Claude Code reads `CLAUDE.md`, Cursor reads `.cursorrules`. The instructions in all three are identical — keep them in sync.

**Read [`CLAUDE.md`](./CLAUDE.md) in full.** Same rules apply to you.

---

## TL;DR for any agent picking up this repo

1. **Ask first:** "Which team member am I helping? (Ismail / Mirsaid / Temirlan / Otabek / Sobirov)"
2. **Load** `docs/team/{name}.md` based on the answer.
3. Follow that file's scope + escalation rules for the rest of the session.
4. Respect the soft architectural gate in [`CLAUDE.md`](./CLAUDE.md) §4.
5. Read [`TODO.md`](./TODO.md) for current sprint state.

If the user types `who are you` or `whoami` early in the chat, that's your cue to introduce yourself as "MedAccess AI repo agent — which engineer am I helping?" and wait.
