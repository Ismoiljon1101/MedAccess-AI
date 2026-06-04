import { Schema, model, type Document } from 'mongoose';

export interface IVisionFinding {
  finding: string;
  confidence: 'high' | 'moderate' | 'low';
  notes: string;
}

export interface IReportAnalysis extends Omit<Document, 'model'> {
  patientId?: Schema.Types.ObjectId;
  sessionId?: string;
  imageType: string;
  qualityNotes: string;
  keyObservations: string[];
  findings: IVisionFinding[];
  suggestedFollowUp: string[];
  disclaimer: string;
  model: string;
  imageMimeType?: string;
  imageSizeBytes?: number;
}

const VisionFindingSchema = new Schema<IVisionFinding>({
  finding:    { type: String, required: true },
  confidence: { type: String, enum: ['high','moderate','low'], required: true },
  notes:      { type: String, default: '' },
}, { _id: false });

const ReportAnalysisSchema = new Schema<IReportAnalysis>({
  patientId:         { type: Schema.Types.ObjectId, ref: 'Patient' },
  sessionId:         { type: String },
  imageType:         { type: String, default: 'unknown' },
  qualityNotes:      { type: String, default: '' },
  keyObservations:   [{ type: String }],
  findings:          [VisionFindingSchema],
  suggestedFollowUp: [{ type: String }],
  disclaimer:        { type: String, default: '' },
  model:             { type: String, required: true },
  imageMimeType:     { type: String },
  imageSizeBytes:    { type: Number },
}, { timestamps: true });

ReportAnalysisSchema.index({ patientId: 1 });

export const ReportAnalysis = model<IReportAnalysis>('ReportAnalysis', ReportAnalysisSchema);
