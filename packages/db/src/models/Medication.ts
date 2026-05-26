import { Schema, model, type Document } from 'mongoose';

export interface IMedication extends Document {
  patientId: Schema.Types.ObjectId;
  name: string;
  dose?: string;
}

const MedicationSchema = new Schema<IMedication>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  name:      { type: String, required: true },
  dose:      { type: String },
}, { timestamps: true });

export const Medication = model<IMedication>('Medication', MedicationSchema);
