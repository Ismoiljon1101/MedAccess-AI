import { Schema, model, type Document } from 'mongoose';
import type { MedicalSpecialty } from '@medaccess/shared';

export interface IDoctor extends Document {
  name: string;
  specialty: MedicalSpecialty;
  facilityId: string;  // seed IDs ('f1'…) or real ObjectId strings
  licenseNo?: string;
  phone?: string;
  email?: string;
  bio?: string;
  languages: string[];
  consultationMinutes: number;  // default slot duration: 20, 30, 60
  active: boolean;
}

const DoctorSchema = new Schema<IDoctor>({
  name:                { type: String, required: true, trim: true },
  specialty:           { type: String, required: true },
  facilityId:          { type: String, required: true },   // seed IDs or real ObjectId strings
  licenseNo:           { type: String },
  phone:               { type: String },
  email:               { type: String },
  bio:                 { type: String, maxlength: 500 },
  languages:           [{ type: String }],
  consultationMinutes: { type: Number, default: 30 },
  active:              { type: Boolean, default: true },
}, { timestamps: true });

DoctorSchema.index({ facilityId: 1, active: 1 });
DoctorSchema.index({ specialty: 1, active: 1 });

export const Doctor = model<IDoctor>('Doctor', DoctorSchema);
