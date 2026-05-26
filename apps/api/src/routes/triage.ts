import { Router } from 'express';
import {
  TriageRequestSchema,
  TriageResultSchema,
  triagePrompt,
  type TriageResult,
} from '@medaccess/shared';
import { chat, safeParseJson } from '../services/llm.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

router.post('/', async (req, res, next) => {
  try {
    const parsed = TriageRequestSchema.parse(req.body);

    const vitalsLines = parsed.vitals
      ? Object.entries(parsed.vitals)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : '';

    const userMsg = [
      `Case: ${parsed.caseSummary}`,
      vitalsLines ? `Vitals: ${vitalsLines}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const system = triagePrompt({ language: parsed.language });

    const { text, model } = await chat({
      system,
      messages: [{ role: 'user', content: userMsg }],
      model: parsed.model,
      json: true,
      temperature: 0.2,
      maxTokens: 700,
    });

    const json = safeParseJson<TriageResult>(text);
    if (!json) throw new HttpError(502, 'Upstream returned non-JSON', { code: 'ParseError' });

    const validated = TriageResultSchema.safeParse(json);

    res.json({
      triage: validated.success ? validated.data : json,
      model,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { code: 'ValidationError', publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

export default router;
