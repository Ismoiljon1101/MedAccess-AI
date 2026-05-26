import { Schema, model, type Document } from 'mongoose';

export interface IEncounter extends Document {
  patientId:   Schema.Types.ObjectId;
  clinicianId: Schema.Types.ObjectId;
  status:      'open' | 'signed' | 'closed';
  startedAt:   Date;
  closedAt?:   Date;
}

const EncounterSchema = new Schema<IEncounter>({
  patientId:   { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  clinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status:      { type: String, enum: ['open','signed','closed'], default: 'open' },
  startedAt:   { type: Date, default: Date.now },
  closedAt:    { type: Date },
}, { timestamps: true });

EncounterSchema.index({ patientId: 1 });
EncounterSchema.index({ clinicianId: 1 });

export const Encounter = model<IEncounter>('Encounter', EncounterSchema);
