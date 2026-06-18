import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  // Read the URI at call time, not module load — server.ts loads dotenv in its
  // body, so a module-level const would capture the value BEFORE .env is applied
  // and silently fall back to localhost (the bug that hid a configured Atlas URI).
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medaccess';

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  isConnected = true;
  console.log(`  MongoDB connected: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

export function dbReady(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export { mongoose };
