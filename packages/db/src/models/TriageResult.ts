import { Schema, model, type Document } from 'mongoose';

export interface ITriageResult extends Omit<Document, 'model'> {
  patientId?: Schema.Types.ObjectId;
  sessionId?: string;
  caseSummary: string;
  level: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE';
  levelLabel: string;
  targetTimeToCare: string;
  rationale: string;
  actions: string[];
  warningSigns: string[];
  model: string;
}

const TriageResultSchema = new Schema<ITriageResult>({
  patientId:        { type: Schema.Types.ObjectId, ref: 'Patient' },
  sessionId:        { type: String },
  caseSummary:      { type: String, required: true },
  level:            { type: String, enum: ['RED','ORANGE','YELLOW','GREEN','BLUE'], required: true },
  levelLabel:       { type: String, default: '' },
  targetTimeToCare: { type: String, default: '' },
  rationale:        { type: String, default: '' },
  actions:          [{ type: String }],
  warningSigns:     [{ type: String }],
  model:            { type: String, required: true },
}, { timestamps: true });

TriageResultSchema.index({ patientId: 1 });

export const TriageResult = model<ITriageResult>('TriageResult', TriageResultSchema);
