import { Schema, model, type Document } from 'mongoose';

export interface IMessage {
  role:      'user' | 'assistant';
  content:   string;
  citations: Array<{ ragDocId: Schema.Types.ObjectId; score: number }>;
  createdAt: Date;
}

export interface IInterview extends Omit<Document, 'model'> {
  encounterId?: Schema.Types.ObjectId;  // optional: anonymous patient sessions have no encounter
  sessionId:    string;                 // maps to in-memory session key
  language:     string;
  model:        string;
  messages:     IMessage[];
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
  encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
  sessionId:   { type: String, required: true, unique: true },
  language:    { type: String, default: 'English' },
  model:       { type: String, required: true },
  messages:    [MessageSchema],
}, { timestamps: true });

export const Interview = model<IInterview>('Interview', InterviewSchema);
