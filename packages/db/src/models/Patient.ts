import { Schema, model, type Document } from 'mongoose';
import type { BloodType } from '@medaccess/shared';

export interface IEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface IPatient extends Document {
  // Identity
  fullName: string;
  dateOfBirth?: Date;
  sex?: 'male' | 'female' | 'other' | 'unknown';
  bloodType?: BloodType;
  nationalId?: string;         // National ID / passport number

  // Contact
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  preferredLanguage: string;

  // Insurance / billing
  insuranceProvider?: string;
  insuranceNumber?: string;

  // Emergency contact
  emergencyContact?: IEmergencyContact;

  // Clinical history (kept as strings for v0.1; structured in v0.2)
  knownAllergies: string[];
  chronicConditions: string[];
  currentMedications: string[];

  // Facility link (optional — patient may not be registered at one facility)
  homeFacilityId?: Schema.Types.ObjectId;
  primaryDoctorId?: Schema.Types.ObjectId;

  // Session reference (MA Agent interview that created this patient record)
  sessionId?: string;

  active: boolean;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>({
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, required: true },
  relationship: { type: String, required: true },
}, { _id: false });

const PatientSchema = new Schema<IPatient>({
  fullName:          { type: String, required: true, trim: true },
  dateOfBirth:       { type: Date },
  sex:               { type: String, enum: ['male', 'female', 'other', 'unknown'] },
  bloodType:         { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
  nationalId:        { type: String },

  phone:             { type: String },
  email:             { type: String },
  address:           { type: String },
  city:              { type: String },
  country:           { type: String },
  preferredLanguage: { type: String, default: 'English' },

  insuranceProvider: { type: String },
  insuranceNumber:   { type: String },

  emergencyContact:  { type: EmergencyContactSchema },

  knownAllergies:    [{ type: String }],
  chronicConditions: [{ type: String }],
  currentMedications:[{ type: String }],

  homeFacilityId:    { type: Schema.Types.ObjectId, ref: 'Facility' },
  primaryDoctorId:   { type: Schema.Types.ObjectId, ref: 'Doctor' },
  sessionId:         { type: String },

  active:            { type: Boolean, default: true },
}, { timestamps: true });

PatientSchema.index({ fullName: 'text', phone: 1 });
PatientSchema.index({ homeFacilityId: 1, active: 1 });
PatientSchema.index({ sessionId: 1 });
PatientSchema.index({ nationalId: 1 }, { sparse: true });

export const Patient = model<IPatient>('Patient', PatientSchema);
