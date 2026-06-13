import { z } from 'zod';

// ---------- Chat ------------------------------------------------------

export const ChatRoleSchema = z.enum(['user', 'assistant']);

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1).max(8000),
});

export const ChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(8000),
  history: z.array(ChatMessageSchema).optional(),
  language: z.string().optional(),
  model: z.string().optional(),
  useRag: z.boolean().optional().default(true),
  patientPhone: z.string().optional(),
});

export const ChatResponseSchema = z.object({
  sessionId: z.string(),
  message: ChatMessageSchema,
  model: z.string(),
  citations: z.array(z.object({
    id: z.string(),
    title: z.string(),
    score: z.number(),
  })),
});

// ---------- Patient ---------------------------------------------------

export const PatientCreateSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(1),
  dateOfBirth: z.string().optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
  bloodType: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('South Korea'),
  preferredLanguage: z.string().default('Korean'),
  knownAllergies: z.array(z.string()).default([]),
  chronicConditions: z.array(z.string()).default([]),
  currentMedications: z.array(z.string()).default([]),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string(),
  }).optional(),
});

export const PatientUpdateSchema = PatientCreateSchema.partial().omit({ phone: true });

// ---------- Symptoms --------------------------------------------------

export const PatientContextSchema = z.object({
  age: z.number().int().min(0).max(130).optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
  pregnancy: z.boolean().optional(),
  knownConditions: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
}).partial();

export const SymptomsRequestSchema = z.object({
  symptoms: z.array(z.string().min(1)).min(1).max(40),
  patient: PatientContextSchema.optional(),
  language: z.string().optional(),
  model: z.string().optional(),
  patientPhone: z.string().optional(),
});

export const DifferentialSchema = z.object({
  condition: z.string(),
  likelihood: z.enum(['high', 'moderate', 'low']),
  probabilityPct: z.number().min(0).max(100),
  reasoning: z.string(),
  redFlags: z.array(z.string()).default([]),
});

export const SymptomsAnalysisSchema = z.object({
  differentials: z.array(DifferentialSchema),
  recommendedNextSteps: z.array(z.string()),
  urgency: z.enum(['self-care', 'see-clinician-soon', 'urgent', 'emergency']),
  disclaimer: z.string(),
});

// ---------- Triage ----------------------------------------------------

export const VitalsSchema = z.object({
  hrBpm: z.number().min(0).max(300).optional(),
  rrBpm: z.number().min(0).max(120).optional(),
  sbpMmHg: z.number().min(0).max(300).optional(),
  dbpMmHg: z.number().min(0).max(250).optional(),
  spo2Pct: z.number().min(0).max(100).optional(),
  tempC: z.number().min(20).max(45).optional(),
  gcs: z.number().min(3).max(15).optional(),
}).partial();

export const TriageRequestSchema = z.object({
  caseSummary: z.string().min(5).max(4000),
  vitals: VitalsSchema.optional(),
  language: z.string().optional(),
  model: z.string().optional(),
  patientPhone: z.string().optional(),
});

export const TriageLevelSchema = z.enum(['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE']);

export const TriageResultSchema = z.object({
  level: TriageLevelSchema,
  levelLabel: z.string(),
  targetTimeToCare: z.string(),
  rationale: z.string(),
  actions: z.array(z.string()),
  warningSigns: z.array(z.string()),
});

// ---------- Vision / Reports -----------------------------------------

export const VisionFindingSchema = z.object({
  finding: z.string(),
  confidence: z.enum(['high', 'moderate', 'low']),
  notes: z.string().default(''),
});

export const VisionAnalysisSchema = z.object({
  imageType: z.string(),
  qualityNotes: z.string(),
  keyObservations: z.array(z.string()),
  possibleFindings: z.array(VisionFindingSchema),
  suggestedFollowUp: z.array(z.string()),
  disclaimer: z.string(),
});

// ---------- Care Discovery -------------------------------------------

export const DoctorSummarySchema = z.object({
  id:                  z.string(),
  name:                z.string(),
  specialty:           z.string(),
  consultationMinutes: z.number().default(30),
  languages:           z.array(z.string()).default([]),
  bio:                 z.string().optional(),
});

export const FacilityResultSchema = z.object({
  id:               z.string(),
  name:             z.string(),
  type:             z.enum(['hospital', 'clinic', 'pharmacy']).default('clinic'),
  city:             z.string().default(''),
  country:          z.string().default(''),
  address:          z.string().optional(),
  phone:            z.string().optional(),
  openingHours:     z.string().optional(),
  lat:              z.number().optional(),
  lng:              z.number().optional(),
  specialties:      z.array(z.string()).default([]),
  rating:           z.number().optional(),
  avgWaitMinutes:   z.number().nullable().optional(),
  distanceKm:       z.number().nullable().optional(),
  enrolled:         z.boolean().default(true),
  doctors:          z.array(DoctorSummarySchema).default([]),
});

export const MapPlaceSchema = z.object({
  placeId:    z.string(),
  name:       z.string(),
  address:    z.string().optional(),
  lat:        z.number(),
  lng:        z.number(),
  phone:      z.string().optional(),
  rating:     z.number().optional(),
  openNow:    z.boolean().optional(),
  types:      z.array(z.string()).default([]),
  distanceKm: z.number().nullable().optional(),
  navUrl:     z.string(),
  source:     z.enum(['google', 'naver', 'stub']).default('naver'),
});

// ---------- Appointment -----------------------------------------------

export const AppointmentStatusSchema = z.enum(['pending', 'confirmed', 'cancelled', 'completed']);

// 24-char hex Mongo ObjectId — agentAnalysis refs are server-generated document
// ids, so reject non-ObjectId-shaped values at the boundary instead of letting
// them reach the DB layer.
const ObjectIdString = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const BookAppointmentSchema = z.object({
  patientPhone: z.string().default(''),
  // Optional patient details — used to create/enrich the Patient record when the
  // booking comes from the Find Care form for someone who hasn't onboarded.
  patientName: z.string().max(200).optional(),
  patientEmail: z.string().email().optional().or(z.literal('')),
  patientAge: z.number().int().min(0).max(130).optional(),
  patientSex: z.enum(['male', 'female', 'other']).optional(),
  facilityId: z.string().min(1),
  doctorId: z.string().min(1),
  specialty: z.string().min(1),
  urgency: z.string().default('see-clinician-soon'),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  agentSummary: z.string().max(4000).optional(),
  agentAnalysis: z.object({
    symptomsId:    ObjectIdString.optional(),
    triageId:      ObjectIdString.optional(),
    imageReportId: ObjectIdString.optional(),
  }).optional(),
  sessionId: z.string().optional(),
  slotId: z.string().optional(),
});

// ---------- Facility Registration ------------------------------------

export const FacilityRegisterSchema = z.object({
  name: z.string().min(1).max(300),
  type: z.enum(['hospital', 'clinic', 'pharmacy']),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('South Korea'),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  specialties: z.array(z.string()).default([]),
});

export const DoctorRegisterSchema = z.object({
  name: z.string().min(1).max(200),
  specialty: z.string().min(1),
  facilityId: z.string().min(1),
  licenseNo: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  bio: z.string().max(500).optional(),
  languages: z.array(z.string()).default(['Korean']),
  consultationMinutes: z.number().default(30),
});

// ---------- Transcription --------------------------------------------

export const TranscribeResponseSchema = z.object({
  text: z.string(),
  language: z.string().optional(),
  duration: z.number().optional(),
  model: z.string(),
});

// ---------- Inferred types -------------------------------------------

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type PatientCreate = z.infer<typeof PatientCreateSchema>;
export type PatientUpdate = z.infer<typeof PatientUpdateSchema>;
export type PatientContext = z.infer<typeof PatientContextSchema>;
export type SymptomsRequest = z.infer<typeof SymptomsRequestSchema>;
export type Differential = z.infer<typeof DifferentialSchema>;
export type SymptomsAnalysis = z.infer<typeof SymptomsAnalysisSchema>;
export type Vitals = z.infer<typeof VitalsSchema>;
export type TriageRequest = z.infer<typeof TriageRequestSchema>;
export type TriageLevel = z.infer<typeof TriageLevelSchema>;
export type TriageResult = z.infer<typeof TriageResultSchema>;
export type VisionFinding = z.infer<typeof VisionFindingSchema>;
export type VisionAnalysis = z.infer<typeof VisionAnalysisSchema>;
export type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;
export type DoctorSummary = z.infer<typeof DoctorSummarySchema>;
export type FacilityResult = z.infer<typeof FacilityResultSchema>;
export type MapPlace = z.infer<typeof MapPlaceSchema>;
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;
export type BookAppointment = z.infer<typeof BookAppointmentSchema>;
export type FacilityRegister = z.infer<typeof FacilityRegisterSchema>;
export type DoctorRegister = z.infer<typeof DoctorRegisterSchema>;

// Backwards compat alias — remove after all consumers updated
export const ClinicResultSchema = FacilityResultSchema;
export type ClinicResult = FacilityResult;
