import { Schema, model, type Document } from 'mongoose';
import type { BloodType } from '@medaccess/shared';

export interface IEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface IPatient extends Document {
  fullName: string;
  dateOfBirth?: Date;
  sex?: 'male' | 'female' | 'other';
  bloodType?: BloodType;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  country: string;
  preferredLanguage: string;
  emergencyContact?: IEmergencyContact;
  knownAllergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  active: boolean;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>({
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, required: true },
  relationship: { type: String, required: true },
}, { _id: false });

const PatientSchema = new Schema<IPatient>({
  fullName:           { type: String, required: true, trim: true },
  dateOfBirth:        { type: Date },
  sex:                { type: String, enum: ['male', 'female', 'other'] },
  bloodType:          { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
  phone:              { type: String, required: true },
  email:              { type: String },
  address:            { type: String },
  city:               { type: String },
  country:            { type: String, default: 'South Korea' },
  preferredLanguage:  { type: String, default: 'Korean' },
  emergencyContact:   { type: EmergencyContactSchema },
  knownAllergies:     [{ type: String }],
  chronicConditions:  [{ type: String }],
  currentMedications: [{ type: String }],
  active:             { type: Boolean, default: true },
}, { timestamps: true });

PatientSchema.index({ phone: 1 }, { unique: true, sparse: true });
PatientSchema.index({ fullName: 'text' });

export const Patient = model<IPatient>('Patient', PatientSchema);
