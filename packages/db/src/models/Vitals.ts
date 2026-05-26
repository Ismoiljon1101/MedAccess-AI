import { Schema, model, type Document } from 'mongoose';

export interface IVitals extends Document {
  encounterId: Schema.Types.ObjectId;
  hrBpm?:      number;
  rrBpm?:      number;
  sbpMmHg?:    number;
  dbpMmHg?:    number;
  spo2Pct?:    number;
  tempC?:      number;
  gcs?:        number;
}

const VitalsSchema = new Schema<IVitals>({
  encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true },
  hrBpm:       { type: Number, min: 0, max: 300 },
  rrBpm:       { type: Number, min: 0, max: 120 },
  sbpMmHg:     { type: Number, min: 0, max: 300 },
  dbpMmHg:     { type: Number, min: 0, max: 250 },
  spo2Pct:     { type: Number, min: 0, max: 100 },
  tempC:       { type: Number, min: 20, max: 45 },
  gcs:         { type: Number, min: 3, max: 15 },
}, { timestamps: true });

export const Vitals = model<IVitals>('Vitals', VitalsSchema);
