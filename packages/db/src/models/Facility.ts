import { Schema, model, type Document } from 'mongoose';
import type { FacilityType } from '@medaccess/shared';

export interface IFacility extends Document {
  name: string;
  type: FacilityType;
  address?: string;
  city?: string;
  country?: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  website?: string;
  openingHours: { day: string; open: string; close: string }[];
  specialties: string[];
  source: 'registered' | 'naver' | 'google';
  sourceId?: string;
  enrolled: boolean;
  verified: boolean;
  active: boolean;
  rating?: number;
  avgWaitMinutes?: number;
}

const FacilitySchema = new Schema<IFacility>({
  name:           { type: String, required: true, trim: true },
  type:           { type: String, enum: ['hospital', 'clinic', 'pharmacy'], required: true },
  address:        { type: String },
  city:           { type: String },
  country:        { type: String },
  lat:            { type: Number, required: true },
  lng:            { type: Number, required: true },
  phone:          { type: String },
  email:          { type: String },
  website:        { type: String },
  openingHours:   [{
    day:   { type: String },
    open:  { type: String },
    close: { type: String },
  }],
  specialties:    [{ type: String }],
  source:         { type: String, enum: ['registered', 'naver', 'google'], default: 'registered' },
  sourceId:       { type: String },
  enrolled:       { type: Boolean, default: true },
  verified:       { type: Boolean, default: false },
  active:         { type: Boolean, default: true },
  rating:         { type: Number },
  avgWaitMinutes: { type: Number },
}, { timestamps: true });

FacilitySchema.index({ lat: 1, lng: 1 });
FacilitySchema.index({ type: 1, active: 1 });
FacilitySchema.index({ specialties: 1 });
FacilitySchema.index({ enrolled: 1, active: 1 });
FacilitySchema.index({ sourceId: 1 }, { sparse: true });

export const Facility = model<IFacility>('Facility', FacilitySchema);
