import { Schema, model, type Document } from 'mongoose';
import type { FacilityType } from '@medaccess/shared';

export interface IFacility extends Document {
  name: string;
  type: FacilityType;
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  website?: string;
  openingHours: { day: string; open: string; close: string }[];
  specialties: string[];
  source: 'manual' | 'osm' | 'google' | 'naver';
  sourceId?: string;   // external place ID for deduplication
  verified: boolean;
  active: boolean;
}

const FacilitySchema = new Schema<IFacility>({
  name:         { type: String, required: true, trim: true },
  type:         { type: String, enum: ['hospital', 'clinic', 'pharmacy'], required: true },
  address:      { type: String, default: '' },
  city:         { type: String, default: '' },
  country:      { type: String, default: '' },
  lat:          { type: Number, required: true },
  lng:          { type: Number, required: true },
  phone:        { type: String },
  email:        { type: String },
  website:      { type: String },
  openingHours: [{
    day:   { type: String }, // 'Mon', 'Tue', etc. or 'Mon-Fri'
    open:  { type: String }, // '08:00'
    close: { type: String }, // '18:00'
  }],
  specialties:  [{ type: String }],
  source:       { type: String, enum: ['manual', 'osm', 'google', 'naver'], default: 'manual' },
  sourceId:     { type: String },
  verified:     { type: Boolean, default: false },
  active:       { type: Boolean, default: true },
}, { timestamps: true });

// Geo index for $near queries (future: MongoDB $geoNear)
FacilitySchema.index({ lat: 1, lng: 1 });
FacilitySchema.index({ type: 1, active: 1 });
FacilitySchema.index({ specialties: 1 });
FacilitySchema.index({ sourceId: 1 }, { sparse: true });

export const Facility = model<IFacility>('Facility', FacilitySchema);
