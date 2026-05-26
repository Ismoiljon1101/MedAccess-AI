import { Router } from 'express';
import { imageUpload } from '../middleware/upload.js';
import { analyzeMedicalImage } from '../services/vision.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

router.post('/analyze', imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'No image file uploaded (field name: "image")');
    const userNote = (req.body?.note || '').toString().slice(0, 1500);
    const language = (req.body?.language || '').toString().slice(0, 32) || undefined;
    const model = (req.body?.model || '').toString().slice(0, 128) || undefined;

    const result = await analyzeMedicalImage({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      userNote,
      language,
      model,
    });

    res.json({
      model: result.model,
      analysis: result.analysis,
      raw: result.analysis ? undefined : result.raw,
    });
  } catch (err: any) {
    if (err instanceof HttpError) return next(err);
    if (err.message?.includes('File too large')) {
      return next(new HttpError(413, 'Image exceeds size limit'));
    }
    next(err);
  }
});

export default router;
