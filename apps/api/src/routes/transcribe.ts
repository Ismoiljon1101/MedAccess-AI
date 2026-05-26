import { Router } from 'express';
import { audioUpload } from '../middleware/upload.js';
import { transcribeAudio, whisperAvailable } from '../services/transcribe.js';
import { HttpError } from '../middleware/error.js';

const router: Router = Router();

router.get('/status', (_req, res) => {
  res.json({
    available: whisperAvailable(),
    provider: whisperAvailable() ? 'openai-whisper' : 'web-speech-api-fallback',
  });
});

router.post('/', audioUpload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'No audio file uploaded (field name: "audio")');
    const language = (req.body?.language || '').toString().slice(0, 32) || undefined;

    const result = await transcribeAudio({
      buffer: req.file.buffer,
      filename: req.file.originalname || 'audio.webm',
      mimetype: req.file.mimetype,
      language,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
