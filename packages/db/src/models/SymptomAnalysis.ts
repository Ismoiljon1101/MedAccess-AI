import { Schema, model, type Document } from 'mongoose';

export interface IDifferential {
  condition: string;
  likelihood: 'high' | 'moderate' | 'low';
  probabilityPct: number;
  reasoning: string;
  redFlags: string[];
}

export interface ISymptomAnalysis extends Omit<Document, 'model'> {
  patientId?: Schema.Types.ObjectId;
  sessionId?: string;
  symptoms: string[];
  urgency: 'self-care' | 'see-clinician-soon' | 'urgent' | 'emergency';
  differentials: IDifferential[];
  recommendedNextSteps: string[];
  disclaimer: string;
  model: string;
}

const DifferentialSchema = new Schema<IDifferential>({
  condition:      { type: String, required: true },
  likelihood:     { type: String, enum: ['high','moderate','low'], required: true },
  probabilityPct: { type: Number, min: 0, max: 100 },
  reasoning:      { type: String, default: '' },
  redFlags:       [{ type: String }],
}, { _id: false });

const SymptomAnalysisSchema = new Schema<ISymptomAnalysis>({
  patientId:            { type: Schema.Types.ObjectId, ref: 'Patient' },
  sessionId:            { type: String },
  symptoms:             [{ type: String }],
  urgency:              { type: String, enum: ['self-care','see-clinician-soon','urgent','emergency'], required: true },
  differentials:        [DifferentialSchema],
  recommendedNextSteps: [{ type: String }],
  disclaimer:           { type: String, default: '' },
  model:                { type: String, required: true },
}, { timestamps: true });

SymptomAnalysisSchema.index({ patientId: 1 });
SymptomAnalysisSchema.index({ sessionId: 1 });

export const SymptomAnalysis = model<ISymptomAnalysis>('SymptomAnalysis', SymptomAnalysisSchema);
