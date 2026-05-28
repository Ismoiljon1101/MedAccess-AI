# Mirsaid — Ops + QA

> **Role:** Operations and quality assurance. Non-coder.
> **Identity check:** confirm "you are Mirsaid" before proceeding.

---

## Lane

Mirsaid does the things engineers hate doing but the project dies without:

1. **API key procurement** — buy OpenRouter credit, OpenAI credit (for Whisper), LiveKit credits when needed. Hand keys to Ismail securely (1Password / signal / in person — **never email, never commit**).
2. **Deployment & infrastructure ops** — Vercel / Railway / Fly accounts, DNS, MongoDB Atlas cluster setup, environment variable management on hosted environments.
3. **Quality assurance** — manual testing of every feature on every device he can get his hands on. File bugs to `docs/qa/issues.md`.
4. **Demo logistics** — backup phones, hotspot, screen-share rehearsal.

## Files Mirsaid owns

- [`docs/qa/issues.md`](../qa/issues.md) — the bug inbox. Append-only from his side; engineers update status when assigned.
- `.env.example` (proposing new variables when a new service is added — Ismail merges)

## Current sprint priorities

1. **OpenRouter key health check** — make sure the team has at least $20 credit. Top up before the demo.
2. **MongoDB Atlas cluster** — provision a free-tier cluster, hand URI to Ismail.
3. **LiveKit account** — if voice mode is being demoed, get LiveKit Cloud creds.
4. **QA pass** every feature listed in [`TODO.md`](../../TODO.md) §6 Acceptance Criteria. File one bug per issue found.
5. **Backup plan** — record a 90-second screen capture of the happy path. Save to `docs/demo-backup.mp4` (gitignored — share via Drive link in TODO.md).

## How to file a QA bug (the only format)

Append to [`docs/qa/issues.md`](../qa/issues.md) like this:

```markdown
## #007 · [SEV-2] Voice mode mic icon stays red after stopping
- **Found on:** Patient app, Chrome 131 macOS, 2026-05-29
- **Repro:** Open /voice, tap mic, speak, tap mic again to stop. Icon stays red.
- **Expected:** Icon returns to idle (gray) state.
- **Actual:** Icon stays red until page refresh.
- **Console errors:** none.
- **Owner:** _unassigned_
- **Status:** open
```

Severity scale:
- **SEV-1** Blocker — app crashes, demo dies, data corruption
- **SEV-2** Major — feature broken but workaround exists
- **SEV-3** Minor — visual glitch, copy typo, slow but works
- **SEV-4** Nit — pure polish

## Escalation

- API key purchase / billing → Ismail (he approves the spend)
- Anything code-shaped → file in `docs/qa/issues.md`, **do not** ask the agent to fix it. Engineers will pull from the inbox.

## How to ask the agent

When you (Mirsaid) confirm identity, the agent will only help with:
- Reading and explaining what features exist (so you know what to test)
- Helping you write up bug reports in the correct format
- Drafting commit messages for documentation-only changes
- Looking up environment variable purposes / values

It will **refuse** to write or edit code on your behalf. That keeps the lane clean: engineers code, you find what's broken.
