// Load .env from the repo root so the single root .env serves both apps.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';

import chatRouter from './routes/chat.js';
import symptomsRouter from './routes/symptoms.js';
import triageRouter from './routes/triage.js';
import reportsRouter from './routes/reports.js';
import transcribeRouter from './routes/transcribe.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { ragStatus } from './services/rag.js';
import { defaultChatModel } from './services/llm.js';
import { whisperAvailable } from './services/transcribe.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN, credentials: false }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'medaccess-ai',
    version: '0.1.0',
    providers: {
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      openaiWhisper: whisperAvailable(),
    },
    defaultModel: defaultChatModel(),
    rag: ragStatus(),
    time: new Date().toISOString(),
  });
});

app.use('/api/chat', chatRouter);
app.use('/api/symptoms', symptomsRouter);
app.use('/api/triage', triageRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/transcribe', transcribeRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  const hasOR = Boolean(process.env.OPENROUTER_API_KEY);
  const hasOA = Boolean(process.env.OPENAI_API_KEY);
  console.log(`\nMedAccess AI server listening on http://localhost:${PORT}`);
  console.log(`  CORS origin   : ${CORS_ORIGIN}`);
  console.log(`  OpenRouter key: ${hasOR ? 'detected' : 'MISSING'}`);
  console.log(`  OpenAI key    : ${hasOA ? 'detected (Whisper enabled)' : 'absent (Whisper -> browser fallback)'}`);
  console.log(`  Default model : ${defaultChatModel()}`);
  console.log(`  RAG index     : ${ragStatus().size} docs`);
  if (!hasOR) {
    console.warn('\n  WARNING: OPENROUTER_API_KEY missing. Chat/symptoms/triage/reports will return 503.');
    console.warn('  Copy .env.example to .env at the repo root and add your key.\n');
  }
});
