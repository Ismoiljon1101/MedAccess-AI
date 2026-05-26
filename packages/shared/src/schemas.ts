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

// ---------- Symptoms --------------------------------------------------

export const PatientContextSchema = z.object({
  age: z.number().int().min(0).max(130).optional(),
  sex: z.enum(['male', 'female', 'other', 'unknown']).optional(),
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
