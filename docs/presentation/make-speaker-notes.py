"""
Generate docs/presentation/speaker-notes.pdf — per-slide spoken script for the
18-slide MedAccess AI pitch deck (index.html in this folder).

Run:  python docs/presentation/make-speaker-notes.py
Re-run after editing the deck so the notes stay in sync.
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

OUT = Path(__file__).parent / "speaker-notes.pdf"

TEAL = colors.HexColor("#14a08e")
TEAL_DEEP = colors.HexColor("#0c7a6c")
TEAL_SOFT = colors.HexColor("#e6f7f4")
INK = colors.HexColor("#0f1f1d")
INK_SOFT = colors.HexColor("#41524f")
INK_FAINT = colors.HexColor("#7c8b88")
LINE = colors.HexColor("#e3eae8")

# (number, title, timing, spoken script, the one beat that must land)
SLIDES = [
    ("01", "Healthcare for the next billion patients", "~25s",
     "Hi, we're MedAccess AI. When you think of clinical AI, you probably picture tools for American "
     "hospitals — fast internet, English, an EHR behind everything. We built the opposite: an AI doctor "
     "copilot for the clinics that have the least — rural, multilingual, often one nurse for an entire "
     "district. And our agent doesn't stop at advice. It books the patient into a real clinic. That's "
     "the whole pitch in one line: healthcare that closes the loop, for the next billion patients.",
     "We close the loop — advice becomes an appointment."),

    ("02", "The incumbents serve the already well-served", "~25s",
     "Every serious clinical-AI company today — OpenEvidence, Glass Health, Hippocratic — is racing for "
     "the same customer: the well-served Western clinician. Meanwhile the WHO counts 4.5 billion people "
     "without full access to essential health services, against a projected shortfall of more than ten "
     "million health workers by 2030. And the number of major clinical-AI products built for that "
     "population? Zero. That gap is our wedge.",
     "4.5B people, 10M missing clinicians, zero products. That's the wedge."),

    ("03", "Three pain points define a rural clinic's day", "~25s",
     "On the ground it comes down to three problems. Too few clinicians — minutes per patient, no second "
     "opinion within hours of travel. Language — the provider and the patient often can't run a proper "
     "diagnostic interview in a shared language. And the cruelest one: even when a patient gets a good "
     "read, there's no path to care. No referral, no booking, no follow-up. Advice without an appointment "
     "changes nothing.",
     "The unsolved part isn't the diagnosis — it's the path to care."),

    ("04", "We aren't competing for the US specialist", "~20s",
     "Here's the competitive picture in one table. Every incumbent: English-first, text-first, no medical "
     "images, online-only, built for the US or EU. We're multilingual — seventeen-plus languages — "
     "voice-first, multimodal, and installable as a PWA on any phone. We're not out-competing these "
     "companies at their own game; we're serving the patients they structurally cannot reach.",
     "Different patients, not a better version of the same product."),

    ("05", "Meet MA Agent", "~25s",
     "So meet MA Agent — the colleague a lone clinician never had. It runs in any browser, installs on "
     "any phone, speaks the patient's language, listens to voice, reads X-rays and skin photos — and "
     "books appointments. One deliberate design choice: patients always talk to 'MA Agent', a named, "
     "consistent identity — never 'a chatbot from company X'. Under the hood it's four pieces: a patient "
     "PWA, a clinic portal, one shared API, and a Python sidecar running specialist vision models. And "
     "to be clear: it's decision support. It never replaces a licensed clinician.",
     "A named, trusted colleague — not a chatbot."),

    ("06", "Most clinical AI stops at the read. We close the loop.", "~30s",
     "This is the slide I want you to remember. Most clinical AI stops at the read — we close the loop. "
     "Watch the five steps: the patient describes symptoms in any language, by text, voice, or photo. "
     "After a few turns the agent forms a clinical snapshot — specialty plus urgency. Then the "
     "differentiator: it offers a real open slot with the right doctor. The patient says yes. An "
     "urgency-badged referral lands in that clinic's queue with full context. The doctor confirms in one "
     "tap. And if no enrolled clinic is nearby, we fall back to public maps with one-tap navigation — "
     "the patient always has somewhere to go.",
     "The read isn't the product. The booking is."),

    ("07", "Booking happens inside the conversation", "~25s",
     "How does booking actually work? Inside the conversation — no forms, no buttons. The agent is "
     "handed the doctor's real availability, so it can only offer slots that actually exist — it cannot "
     "invent a time. The moment the patient agrees, a hidden marker in the model's reply silently calls "
     "our booking API. What you see on this screen is the real product experience: three messages, and "
     "the appointment exists.",
     "Three chat bubbles = a confirmed appointment. No forms."),

    ("08", "One copilot, the whole clinical journey", "~20s",
     "Zooming out: one copilot, seven modules across the journey. Patient side — the MA Agent chat and "
     "Find Care with the maps fallback. Clinic side — the urgency-badged patients queue, a structured "
     "interview module, symptom analysis with calibrated differentials, report reading, and "
     "Manchester-style triage. Every module feeds the same loop: patient to clinic.",
     "Not a feature — a full journey, both sides of the visit."),

    ("09", "Generalist LLM plus specialist medical models", "~30s",
     "On medical images we made a bet the research supports. Generic vision LLMs plateau around seventy "
     "to ninety percent on condition-specific reads. Purpose-built models reach ninety-two plus. So we "
     "run specialist models locally: chest X-ray across eighteen pathologies, skin lesions, diabetic "
     "retinopathy — all three live in this demo build — with the malaria smear model queued. The "
     "important part: the language model never diagnoses from pixels. The specialist model reads; the "
     "LLM explains in plain language; and any disagreement is flagged, never silently overridden. These "
     "five diseases drive roughly eighty percent of visits in our target clinics.",
     "Specialists detect, the LLM only explains — disagreements are flagged."),

    ("10", "Clean monorepo. One contract. Graceful degradation.", "~20s",
     "Architecture in one breath: two React PWAs, one Express API, and a single Zod schema contract "
     "shared end to end — zero duplicated types across three apps. MongoDB is fire-and-forget, retrieval "
     "is BM25 over a curated clinical corpus, and the Python sidecar serves the vision models. "
     "Everything degrades gracefully: kill the database, the sidecar, or voice — the app keeps working.",
     "One schema contract; nothing is a single point of failure."),

    ("11", "Every decision earns its place", "~20s",
     "A few engineering decisions that earn their place. An LLM gateway means one environment variable "
     "swaps the model — judges can A/B models live on the same prompt. A cheap-stack default means the "
     "full demo costs effectively zero to run. BM25 instead of a vector database, because at our corpus "
     "size keyword retrieval matches embeddings with no extra infrastructure. A PWA instead of native — "
     "five-second install on an entry-level Android. And no accounts: a phone number is the only "
     "identity a patient needs to book.",
     "Pragmatic choices, each defensible under questioning."),

    ("12", "Trustworthy by construction", "~25s",
     "A medical copilot has to earn trust by construction, not by disclaimer. Four guardrails. A hard "
     "triage floor: chest pain, stroke-like deficits, severe breathing difficulty can never be triaged "
     "below orange — that's enforced in the prompt contract. A held identity: the system never reveals "
     "which model or provider is underneath. Calibrated uncertainty: 'most likely, possible, unlikely' — "
     "never a fake ninety-five percent, never an invented dosage or citation. And privacy by default: "
     "sessions expire, chat history lives on the patient's device.",
     "Safety is enforced in the system's constitution, not promised in fine print."),

    ("13", "v1.0 demo: the headline loop works end to end", "~20s",
     "We grade ourselves honestly. Done: the full patient-to-clinic loop — chat, snapshot, conversational "
     "booking, clinic queue, confirmation. Done: streaming chat with RAG citations, push-to-talk voice, "
     "three live specialist image models, the maps fallback, and clean typechecks across every workspace. "
     "In progress: visual polish. Queued: the malaria weights and a skin-model upgrade. Nothing on this "
     "slide is aspirational — you'll watch it run in a minute.",
     "Every 'DONE' on this slide is about to be demonstrated live."),

    ("14", "If we reach even a fraction, the math is enormous", "~25s",
     "Why this matters at scale. In endemic regions, malaria alone is around forty percent of pediatric "
     "outpatient visits. Pneumonia is fifteen percent of under-five visits in rural South Asia. Our five "
     "Pareto diseases cover roughly eighty percent of what walks into a target clinic — and the hardware "
     "to serve an entire clinic is one two-hundred-dollar laptop on local WiFi. Every screening that "
     "catches a red flag early, or routes a patient to the right doctor today instead of next month, is "
     "a life trajectory changed.",
     "Five diseases ~ 80% of visits; $200 serves a whole clinic."),

    ("15", "A built-in network effect", "~20s",
     "Distribution compounds. Patients arrive through a shared link or QR code — zero install, zero "
     "friction. The maps fallback shows every nearby clinic — which is also our recruitment list. Every "
     "clinic that enrolls gets free, pre-triaged referrals it would never have reached, which makes "
     "in-app booking better, which pulls more patients. We sit in the middle as the routing layer.",
     "The fallback map is also the sales pipeline."),

    ("16", "A credible path from demo to deployment", "~20s",
     "Where this goes. Today: the full closed loop you're about to see — v1.0. Next weeks: "
     "authentication, the pharmacy referral loop, the malaria model, and SMS confirmations. Months out: "
     "a production-scale RAG corpus, clinician-signed summaries, reverse patient matching. With funding: "
     "compliance work, native mobile, offline on-device speech, and EHR write-back. Each step is "
     "engineering, not research risk.",
     "Everything ahead is execution, not invention."),

    ("17", "Five engineers, clear lanes", "~15s",
     "The team: five engineers with clear lanes — architecture, the ML models, product UI, ops and QA, "
     "and docs — under one discipline: schemas first, strict types, conventional commits, and no "
     "refactors of working code two weeks before a deadline. Even our AI coding agents are role-scoped: "
     "every session starts by asking which engineer it's helping.",
     "Small team, unusual discipline."),

    ("18", "Let's watch it close the loop", "~15s + demo",
     "That's the story. Now let's watch it close the loop — live. On the left screen, a patient "
     "describes symptoms on a phone. On the right, the clinic portal. You'll see the conversation become "
     "a booking, and the booking become a confirmed appointment in the doctor's queue. And if you'd like "
     "to try it yourself, scan the QR on the demo screen — it runs on your phone, right now. Thank you.",
     "End on the live loop; invite them to scan the QR."),
]

DELIVERY_TIPS = [
    "Total: about 7 minutes of talk, then the live demo. If your slot is 5 minutes, compress "
    "slides 10-11 and 15-16 to one sentence each — never cut slides 2, 6, or 13.",
    "Slide 6 is the money slide. Slow down, point at the five steps, and say the beat line word for word.",
    "Let the stats breathe: after '4.5 billion' and after 'eighty percent', pause for one beat.",
    "Keys during the talk: arrows or space to advance, F for fullscreen. The deck auto-hides its hints.",
]


def styles():
    base = dict(fontName="Helvetica", textColor=INK, alignment=TA_LEFT)
    return {
        "brand": ParagraphStyle("brand", fontSize=11, leading=14, fontName="Helvetica-Bold",
                                textColor=TEAL, spaceAfter=2),
        "title": ParagraphStyle("title", fontSize=26, leading=30, fontName="Helvetica-Bold",
                                textColor=INK, spaceAfter=6),
        "meta": ParagraphStyle("meta", fontSize=10.5, leading=15, textColor=INK_FAINT, **{k: v for k, v in base.items() if k != "textColor"}),
        "tip": ParagraphStyle("tip", fontSize=9.5, leading=14, textColor=INK_SOFT,
                              fontName="Helvetica", leftIndent=10, bulletIndent=0, spaceAfter=3),
        "slidehead": ParagraphStyle("slidehead", fontSize=12.5, leading=16, fontName="Helvetica-Bold",
                                    textColor=INK),
        "timing": ParagraphStyle("timing", fontSize=9.5, leading=16, fontName="Helvetica-Bold",
                                 textColor=INK_FAINT, alignment=2),
        "script": ParagraphStyle("script", fontSize=10.5, leading=16.5, textColor=INK_SOFT,
                                 fontName="Helvetica", spaceBefore=5),
        "beat": ParagraphStyle("beat", fontSize=9.5, leading=13, fontName="Helvetica-Oblique",
                               textColor=TEAL_DEEP, spaceBefore=5),
    }


def build():
    s = styles()
    doc = SimpleDocTemplate(
        str(OUT), pagesize=A4,
        leftMargin=17 * mm, rightMargin=17 * mm, topMargin=16 * mm, bottomMargin=15 * mm,
        title="MedAccess AI — Pitch Speaker Notes", author="MedAccess AI",
    )
    story = []

    # ── Cover header ──────────────────────────────────────────────────────
    story.append(Paragraph("Med<font color='#14a08e'>Access</font> AI", s["brand"]))
    story.append(Paragraph("Pitch Speaker Notes", s["title"]))
    story.append(Paragraph(
        "18 slides &nbsp;·&nbsp; ~7 minutes of talk + live demo &nbsp;·&nbsp; "
        "each entry: what to <b>say</b>, and the one <b>beat</b> that must land.", s["meta"]))
    story.append(Spacer(1, 8))

    tips = [[Paragraph("<b>Delivery</b>", ParagraphStyle("th", fontSize=9.5, fontName="Helvetica-Bold",
                                                          textColor=TEAL_DEEP))]]
    tips += [[Paragraph(f"&bull;&nbsp; {t}", s["tip"])] for t in DELIVERY_TIPS]
    t = Table(tips, colWidths=[doc.width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#bfe6df")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
        ("TOPPADDING", (0, 1), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -2), 1),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    # ── Per-slide entries ─────────────────────────────────────────────────
    for num, title, timing, script, beat in SLIDES:
        head = Table(
            [[Paragraph(f"<font color='#14a08e'>{num}</font>&nbsp;&nbsp;{title}", s["slidehead"]),
              Paragraph(timing, s["timing"])]],
            colWidths=[doc.width - 70, 70],
        )
        head.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        block = [
            head,
            Paragraph(script, s["script"]),
            Paragraph(f"Land: {beat}", s["beat"]),
            Spacer(1, 7),
            HRFlowable(width="100%", thickness=0.6, color=LINE),
            Spacer(1, 9),
        ]
        story.append(KeepTogether(block))

    doc.build(story)
    print(f"OK -> {OUT}  ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
