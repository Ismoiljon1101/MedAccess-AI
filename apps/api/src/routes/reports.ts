import { Router } from 'express';
import { imageUpload } from '../middleware/upload.js';
import { analyzeImageFull } from '../services/vision.js';
import { ReportAnalysis, dbReady } from '@medaccess/db';
import { getIdByPhone } from '../services/patient.service.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

router.post('/analyze', imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'No image file uploaded (field name: "image")');

    const userNote = (req.body?.note   || '').toString().slice(0, 1500);
    const language = (req.body?.language || '').toString().slice(0, 32) || undefined;
    const model    = (req.body?.model   || '').toString().slice(0, 128) || undefined;

    const result = await analyzeImageFull({ buffer: req.file.buffer, mimetype: req.file.mimetype, userNote, language, model });

    if (dbReady() && result.analysis) {
      const patientId = req.body?.patientPhone
        ? (await getIdByPhone(req.body.patientPhone) ?? undefined)
        : undefined;

      ReportAnalysis.create({
        patientId,
        sessionId:         req.body.sessionId,
        imageType:         result.analysis.imageType,
        qualityNotes:      result.analysis.qualityNotes,
        keyObservations:   result.analysis.keyObservations,
        findings:          result.analysis.possibleFindings,
        suggestedFollowUp: result.analysis.suggestedFollowUp,
        disclaimer:        result.analysis.disclaimer,
        model:             result.model,
        imageMimeType:     req.file!.mimetype,
        imageSizeBytes:    req.file!.size,
      }).catch(() => {});
    }

    res.json({
      model:    result.model,
      analysis: result.analysis,
      raw:      result.analysis ? undefined : result.raw,
      sidecar:  result.sidecar ? { model_used: result.sidecar.model_used, skipped: result.sidecar.skipped } : null,
    });
  } catch (err: any) {
    if (err instanceof HttpError) return next(err);
    if (err.message?.includes('File too large')) return next(new HttpError(413, 'Image exceeds size limit'));
    next(err);
  }
});

export default router;
