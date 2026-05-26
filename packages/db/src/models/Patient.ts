import { Schema, model, type Document } from 'mongoose';

export interface IPatient extends Document {
  clinicId: Schema.Types.ObjectId;
  primaryClinicianId?: Schema.Types.ObjectId;
  age?: number;
  sex?: 'male' | 'female' | 'other' | 'unknown';
  pregnancy?: boolean;
  preferredLanguage: string;
}

const PatientSchema = new Schema<IPatient>({
  clinicId:           { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
  primaryClinicianId: { type: Schema.Types.ObjectId, ref: 'User' },
  age:                { type: Number, min: 0, max: 130 },
  sex:                { type: String, enum: ['male','female','other','unknown'] },
  pregnancy:          { type: Boolean, default: false },
  preferredLanguage:  { type: String, default: 'English' },
}, { timestamps: true });

PatientSchema.index({ clinicId: 1 });

export const Patient = model<IPatient>('Patient', PatientSchema);
