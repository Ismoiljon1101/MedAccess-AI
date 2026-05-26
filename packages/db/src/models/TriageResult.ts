import { Schema, model, type Document } from 'mongoose';

export interface ITriageResult extends Omit<Document, 'model'> {
  encounterId?:    Schema.Types.ObjectId;
  sessionId?:      string;
  caseSummary:     string;
  level:           'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE';
  levelLabel:      string;
  targetTimeToCare: string;
  rationale:       string;
  actions:         string[];
  warningSigns:    string[];
  model:           string;
}

const TriageResultSchema = new Schema<ITriageResult>({
  encounterId:      { type: Schema.Types.ObjectId, ref: 'Encounter' },
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

TriageResultSchema.index({ encounterId: 1 });

export const TriageResult = model<ITriageResult>('TriageResult', TriageResultSchema);
