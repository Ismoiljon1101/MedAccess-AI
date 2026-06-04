import { Router } from 'express';
import { SymptomsRequestSchema, SymptomsAnalysisSchema, symptomAnalysisPrompt, type SymptomsAnalysis } from '@medaccess/shared';
import { SymptomAnalysis, dbReady } from '@medaccess/db';
import { chat, defaultFastModel, safeParseJson } from '../services/llm.js';
import { formatContext, ragStatus, retrieve, toCitations } from '../services/rag.js';
import { getIdByPhone } from '../services/patient.service.js';
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
    ].filter(Boolean).join('\n');

    const results = retrieve(parsed.symptoms.join(' '), { k: 4 });
    const context = formatContext(results);
    const system = symptomAnalysisPrompt({ context, language: parsed.language });

    const { text, model } = await chat({
      system,
      messages: [{ role: 'user', content: summary }],
      model: parsed.model || defaultFastModel(),
      json: true,
      temperature: 0.2,
      maxTokens: 1400,
    });

    const json = safeParseJson<SymptomsAnalysis>(text);
    if (!json) throw new HttpError(502, 'Upstream returned non-JSON', { code: 'ParseError' });

    const validated = SymptomsAnalysisSchema.safeParse(json);
    const analysis = validated.success ? validated.data : json as SymptomsAnalysis;

    if (dbReady()) {
      const patientId = parsed.patientPhone ? (await getIdByPhone(parsed.patientPhone) ?? undefined) : undefined;
      SymptomAnalysis.create({
        patientId,
        sessionId:            req.body.sessionId,
        symptoms:             parsed.symptoms,
        urgency:              analysis.urgency,
        differentials:        analysis.differentials,
        recommendedNextSteps: analysis.recommendedNextSteps,
        disclaimer:           analysis.disclaimer,
        model,
      }).catch(() => {});
    }

    res.json({ analysis, model, citations: toCitations(results), ragStatus: ragStatus() });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return next(new HttpError(400, 'Invalid request', { code: 'ValidationError', publicMessage: err.errors?.[0]?.message }));
    }
    next(err);
  }
});

export default router;
