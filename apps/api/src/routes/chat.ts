import { Router } from 'express';
import { ChatRequestSchema, interviewSystemPrompt } from '@medaccess/shared';
import { Interview, dbReady } from '@medaccess/db';
import { chat, chatStream } from '../services/llm.js';
import { formatContext, ragStatus, retrieve, toCitations } from '../services/rag.js';
import { appendMessage, ensureSession, getSession, newSessionId, replaceMessages } from '../utils/sessions.js';
import { searchEnrolled, getUpcomingSlots } from '../services/facility.service.js';
import { getIdByPhone } from '../services/patient.service.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

// Strip the hidden conversational-booking marker before persisting so it never
// leaks back to the patient on session resume (the live stream still emits the
// raw marker so the client can auto-book; we only clean what we store).
function stripBookingMarker(text: string): string {
  return text.replace(/<<BOOK:[\s\S]*?>>/g, '').trim();
}

// ── Specialty detection from conversation ─────────────────────────────────────
function detectSpecialty(messages: Array<{ role: string; content: string }>): string {
  const combined = messages.map((m) => m.content).join(' ').toLowerCase();
  const specs: Record<string, string[]> = {
    Cardiology:                  ['heart', 'cardiac', 'chest pain', 'palpitation', 'cardiovascular', 'hypertension', '심장', '흉통'],
    Neurology:                   ['headache', 'migraine', 'seizure', 'stroke', 'nerve', 'dizziness', '두통', '어지럼'],
    Pulmonology:                 ['breath', 'respiratory', 'lung', 'asthma', 'cough', 'pneumon', '폐', '기침', '호흡'],
    'Mental Health':             ['mental', 'anxiety', 'depress', 'psychiatr', 'stress', '우울', '불안'],
    Pediatrics:                  ['child', 'pediatr', 'infant', 'baby', 'kid', '소아', '아이'],
    Dermatology:                 ['skin', 'rash', 'lesion', 'eczema', 'acne', '피부', '발진'],
    Ophthalmology:               ['eye', 'vision', 'sight', 'ophtha', '눈', '시력'],
    'Obstetrics & Gynecology':   ['pregnant', 'pregnancy', 'gynec', 'menstrual', '임신', '산부'],
    Gastroenterology:            ['stomach', 'gastro', 'diarrhea', 'nausea', 'digest', '위', '소화', '설사'],
    Orthopedics:                 ['bone', 'fracture', 'joint', 'arthritis', 'spine', '뼈', '관절', '골절'],
  };

  for (const [specialty, keywords] of Object.entries(specs)) {
    if (keywords.some((k) => combined.includes(k))) return specialty;
  }
  return 'General Practice';
}

/**
 * Build the bookable options the agent may propose — real facility names,
 * distance, and the doctor's REAL upcoming open slots so the agent never
 * invents a time. Falls back to all enrolled facilities when no GPS/specialty.
 */
async function getBookableDoctors(specialty: string, lat?: number, lng?: number) {
  let facilities = await searchEnrolled({ specialty, lat, lng, radius: 100 });
  if (facilities.length === 0) facilities = await searchEnrolled({ lat, lng, radius: 100 });

  const options: Array<{
    id: string; name: string; specialty: string;
    facilityId: string; facilityName: string; languages: string[];
    distanceKm?: number | null; slots: { date: string; startTime: string }[];
  }> = [];

  for (const f of facilities.slice(0, 3)) {
    const doc =
      (f.doctors ?? []).find((d: any) => d.specialty?.toLowerCase().includes(specialty.toLowerCase())) ??
      (f.doctors ?? [])[0];
    if (!doc) continue;
    const slots = await getUpcomingSlots(doc.id, f.id, 5);
    options.push({
      id:           String(doc.id),
      name:         doc.name,
      specialty:    doc.specialty,
      facilityId:   String(f.id),
      facilityName: f.name,
      languages:    doc.languages ?? [],
      distanceKm:   f.distanceKm,
      slots,
    });
  }
  return options;
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const parsed = ChatRequestSchema.parse(req.body);
    const sessionId = parsed.sessionId || newSessionId();
    const session = getSession(sessionId) || ensureSession(sessionId);

    if (parsed.history?.length && session.messages.length === 0) {
      replaceMessages(sessionId, parsed.history);
    }
    appendMessage(sessionId, { role: 'user', content: parsed.message });

    const results = parsed.useRag ? retrieve(parsed.message, { k: 3 }) : [];
    const context = formatContext(results);

    const s = getSession(sessionId)!;
    const specialty = detectSpecialty(s.messages);
    const enrolledDoctors = await getBookableDoctors(specialty);
    const system = interviewSystemPrompt({ context, language: parsed.language, enrolledDoctors });

    const { text, model } = await chat({
      system,
      messages: s.messages,
      model: parsed.model,
      temperature: 0.4,
      maxTokens: 900,
    });

    const cleanText = stripBookingMarker(text);
    appendMessage(sessionId, { role: 'assistant', content: cleanText });

    const patientId = parsed.patientPhone ? (await getIdByPhone(parsed.patientPhone) ?? undefined) : undefined;

    if (dbReady()) {
      const msgs = getSession(sessionId)!.messages;
      Interview.findOneAndUpdate(
        { sessionId },
        { $set: { language: parsed.language, model, patientId }, $push: { messages: { $each: msgs.slice(-2) } } },
        { upsert: true, new: true },
      ).catch(() => {});
    }

    res.json({
      sessionId,
      message: { role: 'assistant', content: cleanText },
      model,
      citations: toCitations(results),
      ragStatus: ragStatus(),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { code: 'ValidationError', publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

// ── POST /api/chat/stream ─────────────────────────────────────────────────────
router.post('/stream', async (req, res, next) => {
  try {
    const parsed = ChatRequestSchema.parse(req.body);
    const lat = req.body.lat ? parseFloat(req.body.lat) : undefined;
    const lng = req.body.lng ? parseFloat(req.body.lng) : undefined;

    const sessionId = parsed.sessionId || newSessionId();
    const session = getSession(sessionId) || ensureSession(sessionId);

    if (parsed.history?.length && session.messages.length === 0) {
      replaceMessages(sessionId, parsed.history);
    }
    appendMessage(sessionId, { role: 'user', content: parsed.message });

    const results = parsed.useRag ? retrieve(parsed.message, { k: 3 }) : [];
    const context = formatContext(results);
    const citations = toCitations(results);

    const s = getSession(sessionId)!;
    const specialty = detectSpecialty(s.messages);
    const enrolledDoctors = await getBookableDoctors(specialty, lat, lng);
    const system = interviewSystemPrompt({ context, language: parsed.language, enrolledDoctors });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: meta\ndata: ${JSON.stringify({ sessionId, citations })}\n\n`);

    let assembled = '';
    try {
      for await (const chunk of chatStream({
        system,
        messages: s.messages,
        model: parsed.model,
        temperature: 0.4,
        maxTokens: 900,
      })) {
        if (chunk.type === 'thinking_start') {
          res.write(`event: thinking_start\ndata: {}\n\n`);
        } else if (chunk.type === 'thinking_end') {
          res.write(`event: thinking_end\ndata: {}\n\n`);
        } else {
          assembled += chunk.text;
          res.write(`event: token\ndata: ${JSON.stringify({ delta: chunk.text })}\n\n`);
        }
      }
    } catch (err: any) {
      console.error('[chat/stream] LLM error:', err.message);
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }

    // Persist the cleaned text (no <<BOOK>> marker) so resume never leaks it.
    appendMessage(sessionId, { role: 'assistant', content: stripBookingMarker(assembled) });

    const patientId = parsed.patientPhone ? (await getIdByPhone(parsed.patientPhone) ?? undefined) : undefined;

    if (dbReady()) {
      const msgs = getSession(sessionId)!.messages;
      Interview.findOneAndUpdate(
        { sessionId },
        { $set: { language: parsed.language, patientId }, $push: { messages: { $each: msgs.slice(-2) } } },
        { upsert: true, new: true },
      ).catch(() => {});
    }

    // Booking is now fully conversational: the agent proposes a real injected
    // slot and emits a hidden <<BOOK>> marker on confirmation (see prompts.ts).
    // The old server-side booking_proposal card has been retired to avoid two
    // competing booking UIs.

    res.write(`event: done\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    res.end();
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { code: 'ValidationError', publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

// ── GET /api/chat/session/:id ─────────────────────────────────────────────────
router.get('/session/:id', async (req, res, next) => {
  try {
    let s = getSession(req.params.id);

    if (!s && dbReady()) {
      try {
        const doc = await Interview.findOne({ sessionId: req.params.id }).lean();
        if (doc) {
          s = {
            id: req.params.id,
            messages: doc.messages || [],
            createdAt: (doc as any).createdAt?.getTime?.() || Date.now(),
            updatedAt: (doc as any).updatedAt?.getTime?.() || Date.now(),
          };
        }
      } catch { /* non-fatal */ }
    }

    if (!s) return res.status(404).json({ error: 'NotFound', message: 'Session not found or expired' });
    res.json({ sessionId: s.id, messages: s.messages, updatedAt: s.updatedAt });
  } catch (err) { next(err); }
});

export default router;
