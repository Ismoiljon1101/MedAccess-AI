import { Schema, model, type Document } from 'mongoose';

export interface ISession extends Document {
  sessionId: string;
  patientId?: Schema.Types.ObjectId;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>({
  sessionId: { type: String, required: true, unique: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  messages:  [{
    role:    { type: String, enum: ['user','assistant'] },
    content: { type: String },
  }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const Session = model<ISession>('Session', SessionSchema);
