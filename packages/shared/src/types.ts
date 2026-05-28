// Convenience type aliases derived from Zod schemas live in schemas.ts.
// This file is for ambient types that aren't validated at runtime.

// ── Medical specialties — single source of truth ─────────────────────────────
// Used by: Login.tsx (dropdown), Doctor model, MA Agent referral matching,
//          FindCare filter chips, /api/facilities?specialty= query param.
export const MEDICAL_SPECIALTIES = [
  'General Practice',
  'Family Medicine',
  'Internal Medicine',
  'Emergency Medicine',
  'Pediatrics',
  'Cardiology',
  'Neurology',
  'Dermatology',
  'Ophthalmology',
  'ENT',
  'Psychiatry',
  'Obstetrics & Gynecology',
  'General Surgery',
  'Orthopedics',
  'Radiology',
  'Oncology',
  'Urology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Nephrology',
  'Rheumatology',
  'Infectious Disease',
  'Anesthesiology',
  'Pharmacy',
] as const;

export type MedicalSpecialty = (typeof MEDICAL_SPECIALTIES)[number];

export const FACILITY_TYPES = ['hospital', 'clinic', 'pharmacy'] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export type Provider = 'openrouter';

export interface RagCitation {
  id: string;
  title: string;
  score: number;
}

export interface RagStatus {
  ready: boolean;
  size: number;
  reason?: string;
}

export interface HealthResponse {
  status: 'ok';
  service: 'medaccess-ai';
  version: string;
  providers: {
    openrouter: boolean;
    openaiWhisper: boolean;
  };
  defaultModel: string;
  rag: RagStatus;
  time: string;
}
