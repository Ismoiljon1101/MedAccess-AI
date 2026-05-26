import { Router } from 'express';
import {
  SymptomsRequestSchema,
  SymptomsAnalysisSchema,
  symptomAnalysisPrompt,
  type SymptomsAnalysis,
} from '@medaccess/shared';
import { chat, safeParseJson } from '../services/llm.js';
import { formatContext, ragStatus, retrieve, toCitations } from '../services/rag.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

router.post('/', async (req, res, next) => {
  try {
    const parsed = SymptomsRequestSchema.parse(req.body);

    const summary = [
      `Symptoms: ${parsed.symptoms.join('; ')}`,
      parsed.patient?.age != null && `Age: ${parsed.patient.age}`,
      parsed.patient?.sex && `Sex: ${parsed.patient.sex}`,
      parsed.patient?.pregnancy && 'Pregnant: yes',
      parsed.patient?.knownConditions?.length && `Conditions: ${parsed.patient.knownConditions.join(', ')}`,
      parsed.patient?.medications?.length && `Medications: ${parsed.patient.medications.join(', ')}`,
      parsed.patient?.allergies?.length && `Allergies: ${parsed.patient.allergies.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const results = retrieve(parsed.symptoms.join(' '), { k: 4 });
    const context = formatContext(results);

    const system = symptomAnalysisPrompt({ context, language: parsed.language });

    const { text, model } = await chat({
      system,
      messages: [{ role: 'user', content: summary }],
      model: parsed.model,
      json: true,
      temperature: 0.2,
      maxTokens: 1400,
    });

    const json = safeParseJson<SymptomsAnalysis>(text);
    if (!json) throw new HttpError(502, 'Upstream returned non-JSON', { code: 'ParseError' });

    // Best-effort validation; don't 500 if model is slightly off-spec.
    const validated = SymptomsAnalysisSchema.safeParse(json);

    res.json({
      analysis: validated.success ? validated.data : json,
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

export default router;
