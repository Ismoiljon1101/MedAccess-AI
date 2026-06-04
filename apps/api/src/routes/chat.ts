import { Router } from 'express';
import { ChatRequestSchema, interviewSystemPrompt } from '@medaccess/shared';
import { Interview, dbReady } from '@medaccess/db';
import { chat, chatStream } from '../services/llm.js';
import { formatContext, ragStatus, retrieve, toCitations } from '../services/rag.js';
import { appendMessage, ensureSession, getSession, newSessionId, replaceMessages } from '../utils/sessions.js';
import { getAllActiveDoctors } from '../services/facility.service.js';
import { findBestOption } from '../services/agent-booking.service.js';
import { getIdByPhone } from '../services/patient.service.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

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

// Whether the agent response suggests the patient needs in-person care
function agentSuggestsCare(assembled: string): boolean {
  const lower = assembled.toLowerCase();
  return (
    lower.includes('see a doctor') ||
    lower.includes('visit a doctor') ||
    lower.includes('medical attention') ||
    lower.includes('seek care') ||
    lower.includes('consult a') ||
    lower.includes('see a specialist') ||
    lower.includes('recommend seeing') ||
    lower.includes('in-person') ||
    lower.includes('병원에') ||
    lower.includes('진료를') ||
    lower.includes('의사를')
  );
}

async function getMatchedDoctors(specialty: string) {
  const all = await getAllActiveDoctors(specialty);
  if (all.length > 0) return all.slice(0, 3);
  return (await getAllActiveDoctors()).slice(0, 3);
}

function enrichWithFacilityNames(doctors: any[]) {
  return doctors.map((d) => ({
    id:           String(d._id ?? d.id),
    name:         d.name,
    specialty:    d.specialty,
    facilityId:   String(d.facilityId),
    facilityName: String(d.facilityId),
    languages:    d.languages ?? [],
  }));
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
    const enrolledDoctors = enrichWithFacilityNames(await getMatchedDoctors(specialty));
    const system = interviewSystemPrompt({ context, language: parsed.language, enrolledDoctors });

    const { text, model } = await chat({
      system,
      messages: s.messages,
      model: parsed.model,
      temperature: 0.4,
      maxTokens: 900,
    });

    appendMessage(sessionId, { role: 'assistant', content: text });

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
      message: { role: 'assistant', content: text },
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
    const enrolledDoctors = enrichWithFacilityNames(await getMatchedDoctors(specialty));
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

    appendMessage(sessionId, { role: 'assistant', content: assembled });

    const patientId = parsed.patientPhone ? (await getIdByPhone(parsed.patientPhone) ?? undefined) : undefined;

    if (dbReady()) {
      const msgs = getSession(sessionId)!.messages;
      Interview.findOneAndUpdate(
        { sessionId },
        { $set: { language: parsed.language, patientId }, $push: { messages: { $each: msgs.slice(-2) } } },
        { upsert: true, new: true },
      ).catch(() => {});
    }

    // ── Agent booking proposal trigger ────────────────────────────────────────
    // Propose after ≥3 user turns when agent suggests care AND location known
    const userTurns = getSession(sessionId)!.messages.filter((m) => m.role === 'user').length;
    const hasLocation = lat != null && lng != null;
    const shouldPropose = hasLocation && userTurns >= 3 && agentSuggestsCare(assembled) && specialty !== 'General Practice';

    if (shouldPropose) {
      try {
        const proposal = await findBestOption({ specialty, urgency: 'see-clinician-soon', lat, lng, patientId, sessionId });
        if (proposal) {
          res.write(`event: booking_proposal\ndata: ${JSON.stringify(proposal)}\n\n`);
        }
      } catch {
        // Non-fatal — booking proposal is best-effort
      }
    }

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
