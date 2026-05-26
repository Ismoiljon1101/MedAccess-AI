import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medaccess';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

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
