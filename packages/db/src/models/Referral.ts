import { Schema, model, type Document } from 'mongoose';

export interface IReferral extends Omit<Document, 'model'> {
  sessionId:     string;
  patientName:   string;
  patientPhone?: string;
  clinicId:      string;
  clinicName:    string;
  specialty:     string;
  urgency:       'self-care' | 'see-clinician-soon' | 'urgent' | 'emergency';
  summary:       string;      // MA Agent clinical snapshot text
  /** AI image analysis report — attached when patient uploads a medical image */
  imageAnalysis?: {
    imageType: string;
    findings: Array<{ finding: string; confidence: string; notes: string }>;
    suggestedFollowUp: string[];
    model: string;
  };
  preferredTime?: string;
  status:        'pending' | 'confirmed' | 'cancelled';
  createdAt:     Date;
}

const ReferralSchema = new Schema<IReferral>({
  sessionId:     { type: String, required: true },
  patientName:   { type: String, required: true },
  patientPhone:  { type: String },
  clinicId:      { type: String, required: true },
  clinicName:    { type: String, required: true },
  specialty:     { type: String, required: true },
  urgency:       { type: String, enum: ['self-care','see-clinician-soon','urgent','emergency'], default: 'see-clinician-soon' },
  summary:       { type: String, default: '' },
  imageAnalysis: {
    type: {
      imageType: String,
      findings: [{ finding: String, confidence: String, notes: String }],
      suggestedFollowUp: [String],
      model: String,
    },
    required: false,
  },
  preferredTime: { type: String },
  status:        { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending' },
}, { timestamps: true });

ReferralSchema.index({ clinicId: 1, status: 1 });
ReferralSchema.index({ sessionId: 1 });

export const Referral = model<IReferral>('Referral', ReferralSchema);
