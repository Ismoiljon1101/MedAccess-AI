# MedAccess AI — Full Human UI/UX + Workflow Review

> **Reviewer:** Sobirov (human, real-device testing) · **Owner of fixes:** Ismail / Otabek
> **Why this exists:** the agent verified the code paths, but a human must judge UI/UX,
> copy, feel, and real-world workflow. This is the master checklist. Go top to bottom.

## How to run this review (READ FIRST)

1. Start a session, confirm **"I am Sobirov"** when the agent asks who you are.
2. The agent walks you through this file **one item at a time** — it will NOT dump the
   whole list. It asks one question, waits for your answer, records it, then moves on.
3. For every item answer **clearly**: `PASS` or `FAIL`. If `FAIL`, you MUST give:
   - **What you did** (exact steps)
   - **What you expected**
   - **What actually happened**
   - **Where/how you want it fixed** (your suggestion)
4. If your answer is vague ("kinda works", "looks weird"), the agent will **ask again**
   until it's precise. Do not move on with an unclear answer.
5. The agent ticks the box (`[x]`) on PASS, or marks `❌` and files the detail into
   [`docs/qa/issues.md`](./issues.md) with the right severity on FAIL.
6. Be strict. "It mostly works" is a FAIL until you say exactly what's off.

## Setup gate (nothing else matters until these pass)

- [ ] **G1 · OpenRouter key live** — `curl localhost:4000/api/health` shows `providers.openrouter: true`. Without it, all AI (chat/symptoms/triage/reports) is dead. (Issue #003 — Sobirov verifies the key Mirsaid procured is installed.)
- [ ] **G2 · Apps up** — API :4000, clinic :5173, patient :5174 all load.
- [ ] **G3 · Clean data** — ran `pnpm db:clean` then `node scripts/seed-demo.mjs`; Find Care lists 9 Seoul clinics, no junk ("seoul"/"lkjsdf"/"Test Patient").
- [ ] **G4 · (optional) Image sidecar** — `curl localhost:5001/healthz` ok, or accept image analysis runs in graceful text-only fallback.

For each item below — **Result: ☐ PASS  ☐ FAIL** + notes if FAIL.

---

# PART A — PATIENT APP (http://localhost:5174)

## A0 · Identity / language on entry
- [ ] A0.1 First load shows the Welcome hero (logo, tagline, feature pills).
- [ ] A0.2 "Get Started" → setup form (name, phone*, language, city).
- [ ] A0.3 Submitting with **no phone** is blocked with a clear message.
- [ ] A0.4 Submitting name + phone enters the app; avatar shows your initials.
- [ ] A0.5 "Use anonymously" enters as Guest (no record linking).
- [ ] A0.6 Emergency numbers (119 / 112) are tappable on the hero.

## A1 · Chat (the core screen)
- [ ] A1.1 Greeting from "MA Agent" shows on a fresh chat.
- [ ] A1.2 Type a symptom + Send → AI **streams** a reply within ~5s.
- [ ] A1.3 "Thinking…/Reasoning…" indicator appears before first token.
- [ ] A1.4 Reply is readable markdown (bullets, bold) — no raw `**` or stray symbols.
- [ ] A1.5 Source/citation chips appear under the reply.
- [ ] A1.6 Emergency pill shows **119 · 911 · 999** and dials.
- [ ] A1.7 Send is disabled while AI is responding; re-enables after.
- [ ] A1.8 **No `<<BOOK…>>` marker or code ever shows in a message.**
- [ ] A1.9 "New chat" clears to the greeting.
- [ ] A1.10 **Session persistence:** after a few turns, go to Find Care, come back to Chat → the **same conversation is still there** (NOT a new chat).
- [ ] A1.11 Reopen a past chat from Records → it restores the messages.

## A2 · Conversational booking (chat → real appointment)
- [ ] A2.1 After describing symptoms over a few turns, a "Find Care / Book Care" CTA appears.
- [ ] A2.2 Ask the agent to book a relevant specialist → it proposes a **real doctor + real date/time** (not invented).
- [ ] A2.3 Say "yes book it" → a **"Appointment Booked"** confirmation toast appears.
- [ ] A2.4 The agent's words match reality (it doesn't say "booked" if nothing booked).
- [ ] A2.5 **Anonymous flow:** as a Guest (no phone), booking opens a sheet that asks your **name + phone**, and only then completes — no dead "Sign in to book".
- [ ] A2.6 Booked appointment shows in **Records → Appointments**.

## A3 · In-chat booking sheet (BookingFlow)
- [ ] A3.1 Clinic list loads, sorted by distance when location is on.
- [ ] A3.2 Date strip shows the next days, Sundays skipped, today's date correct (no off-by-one).
- [ ] A3.3 Tapping a date loads time slots.
- [ ] A3.4 Confirm button label is clear and disabled until time + identity present.
- [ ] A3.5 "No in-network specialist" fallback notice is shown when relevant (not a dead end).
- [ ] A3.6 Success state names the doctor, clinic, date, time.

## A4 · Image upload + analysis
- [ ] A4.1 Image button opens the capture flow with a **modality picker** (Skin / X-ray / Eye / Other).
- [ ] A4.2 Guidance (do's/don'ts) + alignment overlay matches the chosen modality.
- [ ] A4.3 A blurry/dark image is **rejected** with a specific reason + Retake.
- [ ] A4.4 A good image uploads; thumbnail shows in the chat.
- [ ] A4.5 Analysis returns a structured, plain-language result (type, observations, findings, follow-up).
- [ ] A4.6 With the sidecar **off**, upload still returns guidance (graceful) — does NOT hard-crash.
- [ ] A4.7 Serious findings auto-surface a Find Care CTA.

## A5 · Voice mode
- [ ] A5.1 Headphones icon opens full-screen voice.
- [ ] A5.2 Hold mic → "Listening…", release → it transcribes your words.
- [ ] A5.3 AI replies and is **spoken aloud**.
- [ ] A5.4 The spoken reply does **NOT** read out any `<<BOOK>>` marker/JSON.
- [ ] A5.5 Booking by voice works (or it cleanly hands off) and shows a booked confirmation.
- [ ] A5.6 Mute toggle silences TTS.
- [ ] A5.7 Exit returns to Chat and the **voice turns are part of the same session**.
- [ ] A5.8 Mic-denied / no speech shows a clear message (not silent).

## A6 · Find Care
- [ ] A6.1 Asks for location; "Detecting…" then shows your area or coords.
- [ ] A6.2 In-network clinics list with type, distance, specialties, hours.
- [ ] A6.3 Type tabs (All/Hospital/Clinic/Pharmacy) filter correctly.
- [ ] A6.4 Specialty chips filter; an empty match shows the fallback banner (no blank screen).
- [ ] A6.5 City search works.
- [ ] A6.6 List ↔ Map toggle; map shows pins.
- [ ] A6.7 "Navigate" links open a working map (Naver/Google) **on this device** (no dead `nmap://` on desktop).
- [ ] A6.8 Expand a clinic → doctors listed → "Book" opens the sheet.
- [ ] A6.9 Booking from Find Care needs name + phone and succeeds.
- [ ] A6.10 "My Appointments" (server-linked) shows your real bookings with live status.

## A7 · My Records
- [ ] A7.1 Consultations tab lists past chats; tapping resumes one.
- [ ] A7.2 Delete a consultation works.
- [ ] A7.3 Appointments tab lists your bookings.
- [ ] A7.4 **Status sync:** after the clinic confirms, this tab shows **confirmed** (not stuck on pending).
- [ ] A7.5 Empty states are friendly with a clear CTA.

## A8 · Profile
- [ ] A8.1 Shows your name/phone/info.
- [ ] A8.2 Editing + saving persists (or is clearly read-only).

## A9 · Settings
- [ ] A9.1 Language list **includes Korean** (and Japanese/Chinese); changing it sticks.
- [ ] A9.2 Theme Light/Dark actually switches the whole app (no unreadable text).
- [ ] A9.3 Font size S/M/L changes chat text.
- [ ] A9.4 "Auto-play AI responses" toggle: when ON, chat replies are spoken; OFF, silent.
- [ ] A9.5 Clear chat history works (with confirm).
- [ ] A9.6 Reset clears profile + data and returns to Welcome.

## A10 · Emergency Check
- [ ] A10.1 Describe an emergency → returns a triage **level with color** (RED→BLUE).
- [ ] A10.2 RED/ORANGE shows a prominent 119 call action.
- [ ] A10.3 Mic input works; failure shows a clear message (not silent).

## A11 · Shell / cross-cutting (judge on every page)
- [ ] A11.1 Header: online dot, emergency, profile avatar all work.
- [ ] A11.2 Bottom nav highlights the active tab.
- [ ] A11.3 Tap targets feel ≥44px on a real phone.
- [ ] A11.4 Loading / empty / error states exist (no blank flashes, no raw error dumps).
- [ ] A11.5 No browser **console errors** during normal use.
- [ ] A11.6 Looks right on a real phone screen (no overflow, no tiny text).
- [ ] A11.7 Installs as a PWA (Add to Home Screen) and opens standalone.

---

# PART B — CLINIC APP (http://localhost:5173)

## B0 · Login / entry
- [ ] B0.1 Login screen has **Sign in** and **Create account** tabs + a **"Jump straight in"** guest row.
- [ ] B0.2 **Guest:** tap Doctor → lands on the portal instantly (no 500, no password).
- [ ] B0.3 Create account (email + password + role) works; doctor "make bookable" can pick/register a clinic.
- [ ] B0.4 Sign in with that account works; wrong password shows a clear error (not a 500).
- [ ] B0.5 Refreshing the page keeps you signed in.

## B1 · Dashboard
- [ ] B1.1 Greeting + your name/role/clinic.
- [ ] B1.2 Stats (pending/confirmed/urgent/total) reflect the real queue.
- [ ] B1.3 Doctor / Pharmacist / Admin each see their tailored dashboard.
- [ ] B1.4 "Recent queue" lists real referrals; "View all" goes to Patients.
- [ ] B1.5 Loading skeleton + error retry behave (no raw 500 text).

## B2 · Patient Queue (the core clinic screen)
- [ ] B2.1 A patient booked from the phone app **appears here** with name, doctor, clinic.
- [ ] B2.2 Urgency badge + color correct; status badge correct.
- [ ] B2.3 Search by name/specialty works; filter tabs (all/pending/confirmed/cancelled) work.
- [ ] B2.4 Expand a row → Patient Profile, Triage, Symptom analysis, **AI Image Analysis**, MA Agent summary all render when present.
- [ ] B2.5 **Confirm Appointment** → row flips to Confirmed and persists on refresh.
- [ ] B2.6 Decline → Cancelled; Reopen works; Mark complete works.
- [ ] B2.7 Auto-refresh (~30s) pulls new bookings without a manual reload.

## B3 · Prescriptions
- [ ] B3.1 List loads; filter tabs work.
- [ ] B3.2 Dispense / Flag / Reopen update status.
- [ ] B3.3 The "v0.2 prescription model" note is present and honest (not pretending to be more).

## B4 · Clinical modules
- [ ] B4.1 **Interview** — type symptoms → AI asks structured follow-ups.
- [ ] B4.2 **Symptoms** — enter symptoms → ranked differential with % bars.
- [ ] B4.3 **Reports** — upload image → structured analysis (or graceful fallback).
- [ ] B4.4 **Triage** — enter case/vitals → Manchester level (RED→BLUE) + actions.
- [ ] B4.5 When the AI service is busy (429), modules show a clean "service busy, retry" message — **never a raw 500**.

## B5 · Profile / Settings
- [ ] B5.1 Profile shows the real account; Sign out works.
- [ ] B5.2 Settings: theme switch, account info, clinic registration, auth status correct.

## B6 · Shell / cross-cutting
- [ ] B6.1 Sidebar nav matches the role (doctor vs pharmacist vs admin).
- [ ] B6.2 Loading / empty / error states everywhere (no raw error dumps).
- [ ] B6.3 No console errors in normal use.
- [ ] B6.4 Readable in both Light and Dark.

---

# PART C — END-TO-END WORKFLOW (the headline)

- [ ] C1 · **Closed loop:** phone signup → chat 3+ turns → book a specialist → open clinic (guest Doctor) → the referral is there with the AI summary → Confirm → back in the phone app **Records shows confirmed**.
- [ ] C2 · **Image loop:** upload a skin/X-ray/eye photo → analysis → Find Care CTA → book → clinic sees the **AI Image Analysis** on that patient.
- [ ] C3 · **Voice loop:** do a booking entirely by voice → confirmation → shows in Records and clinic queue.
- [ ] C4 · **Multilingual:** write in **Korean** (and one more language) → AI replies in that language; UI language setting respected.
- [ ] C5 · **Emergency:** describe a clear emergency → RED/ORANGE triage → 119 prompt.
- [ ] C6 · **Resilience:** kill the image sidecar → image upload degrades gracefully; rate-limit the LLM → friendly retry message, no crash.
- [ ] C7 · **Real device:** run the whole loop on an actual phone (via the HTTPS tunnel) — voice/camera/GPS all need secure context.

---

## Scorecard (agent fills this as the review proceeds)

| Section | Items | Pass | Fail | Notes |
|---|---|---|---|---|
| A · Patient | | | | |
| B · Clinic | | | | |
| C · Workflow | | | | |

Every FAIL becomes a numbered entry in [`docs/qa/issues.md`](./issues.md) with severity, repro, expected/actual, and Sobirov's requested fix.
