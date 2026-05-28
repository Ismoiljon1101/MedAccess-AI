import { Schema, model, type Document } from 'mongoose';

export interface IClinic extends Document {
  // ── Identity ───────────────────────────────────────────────────────────────
  name: string;
  country: string;
  language: string;
  settings: Record<string, unknown>;

  // ── Care Discovery (added for v0.1 — Ismail, 2026-05-28) ──────────────────
  /** True once a real-world clinic has registered & verified in our system. */
  enrolled: boolean;
  /** Geographic coordinates — required for Tier-1 proximity search. */
  lat?: number;
  lng?: number;
  /** Physical address lines */
  address?: string;
  city?: string;
  phone?: string;
  /** Human-readable hours e.g. "Mon–Fri 8am–6pm" */
  openingHours?: string;
  /** Medical specialties offered — used for specialty-filter + doctor routing. */
  offeredSpecialties: string[];
  /** Rating 0–5 (from patient feedback or manual entry) */
  rating?: number;
  /** Average wait time in minutes (null = not tracked) */
  avgWaitMinutes?: number | null;
  /**
   * Reference to a Facility document (optional).
   * Allows a portal Clinic account to map to a physical-world Facility entry
   * in the public facility search index.
   */
  facilityId?: Schema.Types.ObjectId;
}

const ClinicSchema = new Schema<IClinic>({
  name:              { type: String, required: true },
  country:           { type: String, default: '' },
  language:          { type: String, default: 'English' },
  settings:          { type: Schema.Types.Mixed, default: {} },

  // Care Discovery
  enrolled:          { type: Boolean, default: false },
  lat:               { type: Number },
  lng:               { type: Number },
  address:           { type: String },
  city:              { type: String },
  phone:             { type: String },
  openingHours:      { type: String },
  offeredSpecialties: [{ type: String }],
  rating:            { type: Number, min: 0, max: 5 },
  avgWaitMinutes:    { type: Number, default: null },
  facilityId:        { type: Schema.Types.ObjectId, ref: 'Facility' },
}, { timestamps: true });

// Geo index for proximity queries
ClinicSchema.index({ lat: 1, lng: 1 });
ClinicSchema.index({ enrolled: 1, offeredSpecialties: 1 });

export const Clinic = model<IClinic>('Clinic', ClinicSchema);
