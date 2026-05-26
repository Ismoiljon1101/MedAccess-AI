import { Schema, model, type Document } from 'mongoose';

// Persistent session — mirrors the in-memory session store in apps/api/src/utils/sessions.ts
// but survives server restarts and scales across instances.

export interface ISession extends Document {
  sessionId: string;
  userId?:   Schema.Types.ObjectId;  // null for anonymous (patient portal)
  messages:  Array<{ role: 'user' | 'assistant'; content: string }>;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>({
  sessionId: { type: String, required: true, unique: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User' },
  messages:  [{
    role:    { type: String, enum: ['user','assistant'] },
    content: { type: String },
  }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const Session = model<ISession>('Session', SessionSchema);
