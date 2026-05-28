// Load .env from the repo root so the single root .env serves both apps.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import { connectDB, dbReady } from '@medaccess/db';

import chatRouter from './routes/chat.js';
import symptomsRouter from './routes/symptoms.js';
import triageRouter from './routes/triage.js';
import reportsRouter from './routes/reports.js';
import transcribeRouter from './routes/transcribe.js';
import voiceRouter from './routes/voice.js';
import clinicsRouter from './routes/clinics.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { ragStatus } from './services/rag.js';
import { defaultChatModel } from './services/llm.js';
import { whisperAvailable } from './services/transcribe.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Allow both clinic and patient portals in CORS
const allowedOrigins = [
  CORS_ORIGIN,
  'http://localhost:5174',  // patient portal
];
app.use(cors({ origin: allowedOrigins, credentials: false }));
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
    db: { connected: dbReady() },
    time: new Date().toISOString(),
  });
});

app.use('/api/chat', chatRouter);
app.use('/api/symptoms', symptomsRouter);
app.use('/api/triage', triageRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/clinics', clinicsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Connect to MongoDB then start HTTP server
const hasOR = Boolean(process.env.OPENROUTER_API_KEY);
const hasOA = Boolean(process.env.OPENAI_API_KEY);

connectDB()
  .catch((err) => {
    console.warn(`  WARNING: MongoDB connection failed — ${(err as Error).message}`);
    console.warn('  Set MONGODB_URI in .env. Running without DB (sessions in-memory only).\n');
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`\nMedAccess AI server listening on http://localhost:${PORT}`);
      console.log(`  CORS origins  : ${allowedOrigins.join(', ')}`);
      console.log(`  OpenRouter key: ${hasOR ? 'detected' : 'MISSING'}`);
      console.log(`  OpenAI key    : ${hasOA ? 'detected (Whisper enabled)' : 'absent (Whisper → browser fallback)'}`);
      console.log(`  Default model : ${defaultChatModel()}`);
      console.log(`  RAG index     : ${ragStatus().size} docs`);
      console.log(`  MongoDB       : ${dbReady() ? 'connected' : 'not connected (in-memory fallback)'}`);
      if (!hasOR) {
        console.warn('\n  WARNING: OPENROUTER_API_KEY missing. Chat/symptoms/triage/reports will return 503.');
        console.warn('  Copy .env.example to .env at the repo root and add your key.\n');
      }
    });
  });
