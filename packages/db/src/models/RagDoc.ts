import { Schema, model, type Document } from 'mongoose';

export interface IRagDoc extends Document {
  title:      string;
  content:    string;
  tags:       string[];
  indexedAt:  Date;
}

const RagDocSchema = new Schema<IRagDoc>({
  title:     { type: String, required: true },
  content:   { type: String, required: true },
  tags:      [{ type: String }],
  indexedAt: { type: Date, default: Date.now },
}, { timestamps: true });

RagDocSchema.index({ title: 'text', content: 'text' });

export const RagDoc = model<IRagDoc>('RagDoc', RagDocSchema);
