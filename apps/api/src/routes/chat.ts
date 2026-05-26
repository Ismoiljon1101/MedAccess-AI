import { Router } from 'express';
import { ChatRequestSchema, interviewSystemPrompt } from '@medaccess/shared';
import { chat, chatStream } from '../services/llm.js';
import { formatContext, ragStatus, retrieve, toCitations } from '../services/rag.js';
import { appendMessage, ensureSession, getSession, newSessionId, replaceMessages } from '../utils/sessions.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

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

    const system = interviewSystemPrompt({ context, language: parsed.language });

    const { text, model } = await chat({
      system,
      messages: getSession(sessionId)!.messages,
      model: parsed.model,
      temperature: 0.4,
      maxTokens: 900,
    });

    appendMessage(sessionId, { role: 'assistant', content: text });

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

    const system = interviewSystemPrompt({ context, language: parsed.language });

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
        assembled += chunk;
        res.write(`event: token\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
    } catch (err: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }

    appendMessage(sessionId, { role: 'assistant', content: assembled });
    res.write(`event: done\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    res.end();
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { code: 'ValidationError', publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

router.get('/session/:id', (req, res) => {
  const s = getSession(req.params.id);
  if (!s) {
    res.status(404).json({ error: 'NotFound', message: 'Session not found or expired' });
    return;
  }
  res.json({ sessionId: s.id, messages: s.messages, updatedAt: s.updatedAt });
});

export default router;
