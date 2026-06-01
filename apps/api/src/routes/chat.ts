import { Router } from 'express';
import { ChatRequestSchema, interviewSystemPrompt } from '@medaccess/shared';
import { Interview, dbReady } from '@medaccess/db';
import { chat, chatStream } from '../services/llm.js';
import { formatContext, ragStatus, retrieve, toCitations } from '../services/rag.js';
import { appendMessage, ensureSession, getSession, newSessionId, replaceMessages } from '../utils/sessions.js';
import { HttpError } from '../middleware/error.js';
import { getAllActiveDoctors } from './facilities.js';

const router: Router = Router();

// ── Detect specialty from conversation and get matching doctors ──────────
function detectSpecialty(messages: Array<{ role: string; content: string }>): string {
  const combined = messages.map((m) => m.content).join(' ').toLowerCase();
  const specs: Record<string, string[]> = {
    Cardiology: ['heart', 'cardiac', 'chest pain', 'palpitation', 'cardiovascular', 'bp', 'hypertension'],
    Neurology: ['headache', 'migraine', 'neurolog', 'seizure', 'stroke', 'nerve', 'brain', 'dizziness'],
    Respiratory: ['breath', 'respiratory', 'lung', 'asthma', 'pulmon', 'cough', 'pneumon'],
    'Mental Health': ['mental', 'anxiety', 'depress', 'psychiatr', 'psycholog', 'stress'],
    Pediatrics: ['child', 'pediatr', 'infant', 'baby', 'kid'],
    Dermatology: ['skin', 'rash', 'lesion', 'dermat', 'eczema', 'acne'],
    'Obstetrics & Gynecology': ['pregnant', 'pregnancy', 'obstetric', 'gynec', 'menstrual'],
    Gastroenterology: ['stomach', 'gastro', 'digestion', 'diarrhea', 'constipation', 'nausea'],
    Orthopedics: ['bone', 'fracture', 'joint', 'orthoped', 'arthritis', 'spine'],
    'General Practice': [],
  };

  for (const [specialty, keywords] of Object.entries(specs)) {
    if (keywords.some((k) => combined.includes(k))) {
      return specialty;
    }
  }
  return 'General Practice';
}

// Async — pulls active doctors from MongoDB (or in-memory approved list).
// Returns [] when no clinic is registered; agent points patient to Find Care.
async function getMatchedDoctors(specialty: string) {
  const all = await getAllActiveDoctors(specialty);
  if (all.length > 0) return all.slice(0, 3);
  // Fallback to General Practice if specialty not found
  return (await getAllActiveDoctors()).slice(0, 3);
}

function enrichWithFacilityNames(doctors: any[]) {
  return doctors.map((d) => ({
    id: String(d._id ?? d.id),
    name: d.name,
    specialty: d.specialty,
    facilityId: String(d.facilityId),
    facilityName: String(d.facilityId), // clinic name resolved by frontend
    languages: d.languages ?? [],
  }));
}

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

    const s = getSession(sessionId);
    const specialty = detectSpecialty(s!.messages);
    const matchedDocs = await getMatchedDoctors(specialty);
    const enrolledDoctors = enrichWithFacilityNames(matchedDocs);

    const system = interviewSystemPrompt({ context, language: parsed.language, enrolledDoctors });

    const { text, model } = await chat({
      system,
      messages: getSession(sessionId)!.messages,
      model: parsed.model,
      temperature: 0.4,
      maxTokens: 900,
    });

    appendMessage(sessionId, { role: 'assistant', content: text });

    if (dbReady()) {
      const msgs = getSession(sessionId)!.messages;
      Interview.findOneAndUpdate(
        { sessionId },
        {
          $set: { language: parsed.language, model },
          $push: { messages: { $each: msgs.slice(-2) } },
        },
        { upsert: true, new: true },
      ).catch(() => { /* non-fatal */ });
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

router.post('/stream', async (req, res, next) => {
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
    const citations = toCitations(results);

    const s = getSession(sessionId);
    const specialty = detectSpecialty(s!.messages);
    const matchedDocs = await getMatchedDoctors(specialty);
    const enrolledDoctors = enrichWithFacilityNames(matchedDocs);

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
        messages: getSession(sessionId)!.messages,
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
      console.error('[chat/stream] LLM error:', err.message, err.status, err.cause?.code);
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }

    appendMessage(sessionId, { role: 'assistant', content: assembled });

    if (dbReady()) {
      const msgs = getSession(sessionId)!.messages;
      Interview.findOneAndUpdate(
        { sessionId },
        {
          $set: { language: parsed.language },
          $push: { messages: { $each: msgs.slice(-2) } },
        },
        { upsert: true, new: true },
      ).catch(() => { /* non-fatal */ });
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

router.get('/session/:id', async (req, res, next) => {
  try {
    let s = getSession(req.params.id);

    // Fallback to DB if not in memory
    if (!s && dbReady()) {
      try {
        const doc = await Interview.findOne({ sessionId: req.params.id }).lean();
        if (doc) {
          s = {
            id: req.params.id,
            messages: doc.messages || [],
            // reason: Mongoose FlattenMaps doesn't expose timestamps — cast to any
            createdAt: (doc as any).createdAt?.getTime?.() || Date.now(),
            updatedAt: (doc as any).updatedAt?.getTime?.() || Date.now(),
          };
        }
      } catch {
        /* non-fatal */
      }
    }

    if (!s) {
      res.status(404).json({ error: 'NotFound', message: 'Session not found or expired' });
      return;
    }
    res.json({ sessionId: s.id, messages: s.messages, updatedAt: s.updatedAt });
  } catch (err) {
    next(err);
  }
});

export default router;
