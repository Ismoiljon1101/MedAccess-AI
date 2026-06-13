import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import { connectDB, dbReady } from '@medaccess/db';

import authRouter         from './routes/auth.js';
import chatRouter         from './routes/chat.js';
import symptomsRouter     from './routes/symptoms.js';
import triageRouter       from './routes/triage.js';
import reportsRouter      from './routes/reports.js';
import transcribeRouter   from './routes/transcribe.js';
import voiceRouter        from './routes/voice.js';
import patientsRouter     from './routes/patients.js';
import facilitiesRouter   from './routes/facilities.js';
import appointmentsRouter from './routes/appointments.js';
import mapsRouter         from './routes/maps.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { ragStatus } from './services/rag.js';
import { defaultChatModel } from './services/llm.js';
import { whisperAvailable } from './services/transcribe.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const allowedOrigins = [CORS_ORIGIN, 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins, credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status:       'ok',
    service:      'medaccess-ai',
    version:      '0.1.0',
    providers:    { openrouter: Boolean(process.env.OPENROUTER_API_KEY), openaiWhisper: whisperAvailable() },
    defaultModel: defaultChatModel(),
    rag:          ragStatus(),
    db:           { connected: dbReady() },
    time:         new Date().toISOString(),
  });
});

app.use('/api/auth',         authRouter);
app.use('/api/patients',     patientsRouter);
app.use('/api/chat',         chatRouter);
app.use('/api/symptoms',     symptomsRouter);
app.use('/api/triage',       triageRouter);
app.use('/api/reports',      reportsRouter);
app.use('/api/transcribe',   transcribeRouter);
app.use('/api/voice',        voiceRouter);
app.use('/api/facilities',   facilitiesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/maps',         mapsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

connectDB()
  .catch((err) => {
    console.warn(`  WARNING: MongoDB connection failed — ${(err as Error).message}`);
    console.warn('  Running without DB (in-memory fallback active).\n');
  })
  .finally(() => {
    app.listen(PORT, () => {
      const hasOR = Boolean(process.env.OPENROUTER_API_KEY);
      console.log(`\nMedAccess AI — http://localhost:${PORT}`);
      console.log(`  CORS          : ${allowedOrigins.join(', ')}`);
      console.log(`  OpenRouter    : ${hasOR ? 'detected' : 'MISSING'}`);
      console.log(`  Whisper       : ${whisperAvailable() ? 'enabled' : 'browser fallback'}`);
      console.log(`  Default model : ${defaultChatModel()}`);
      console.log(`  RAG index     : ${ragStatus().size} docs`);
      console.log(`  MongoDB       : ${dbReady() ? 'connected' : 'in-memory fallback'}`);
      if (!hasOR) console.warn('\n  WARNING: OPENROUTER_API_KEY missing — chat/symptoms/triage/reports return 503.\n');
    });
  });
