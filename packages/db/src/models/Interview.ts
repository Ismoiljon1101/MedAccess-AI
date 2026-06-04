import { Schema, model, type Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  citations: Array<{ ragDocId: Schema.Types.ObjectId; score: number }>;
  createdAt: Date;
}

export interface IInterview extends Omit<Document, 'model'> {
  patientId?: Schema.Types.ObjectId;
  sessionId: string;
  language: string;
  model: string;
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  role:    { type: String, enum: ['user','assistant'], required: true },
  content: { type: String, required: true },
  citations: [{
    ragDocId: { type: Schema.Types.ObjectId, ref: 'RagDoc' },
    score:    { type: Number },
  }],
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const InterviewSchema = new Schema<IInterview>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  sessionId: { type: String, required: true, unique: true },
  language:  { type: String, default: 'Korean' },
  model:     { type: String, required: true },
  messages:  [MessageSchema],
}, { timestamps: true });

export const Interview = model<IInterview>('Interview', InterviewSchema);
