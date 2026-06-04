import { Schema, model, type Document } from 'mongoose';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface IAgentAnalysis {
  symptomsId?: Schema.Types.ObjectId;
  triageId?: Schema.Types.ObjectId;
  imageReportId?: Schema.Types.ObjectId;
}

export interface IAppointment extends Document {
  patientId: Schema.Types.ObjectId;
  doctorId: Schema.Types.ObjectId;
  facilityId: Schema.Types.ObjectId;
  slotId?: Schema.Types.ObjectId;
  specialty: string;
  urgency: string;
  agentSummary?: string;
  agentAnalysis?: IAgentAnalysis;
  sessionId?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: AppointmentStatus;
  doctorNotes?: string;
  confirmedAt?: Date;
  completedAt?: Date;
}

const AgentAnalysisSchema = new Schema<IAgentAnalysis>({
  symptomsId:    { type: Schema.Types.ObjectId, ref: 'SymptomAnalysis' },
  triageId:      { type: Schema.Types.ObjectId, ref: 'TriageResult' },
  imageReportId: { type: Schema.Types.ObjectId, ref: 'ReportAnalysis' },
}, { _id: false });

const AppointmentSchema = new Schema<IAppointment>({
  patientId:     { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId:      { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  facilityId:    { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  slotId:        { type: Schema.Types.ObjectId, ref: 'TimeSlot' },
  specialty:     { type: String, required: true },
  urgency:       { type: String, default: 'see-clinician-soon' },
  agentSummary:  { type: String, maxlength: 4000 },
  agentAnalysis: { type: AgentAnalysisSchema },
  sessionId:     { type: String },
  scheduledDate: { type: String, required: true },
  scheduledTime: { type: String, required: true },
  status:        { type: String, enum: ['pending','confirmed','cancelled','completed'], default: 'pending' },
  doctorNotes:   { type: String, maxlength: 4000 },
  confirmedAt:   { type: Date },
  completedAt:   { type: Date },
}, { timestamps: true });

AppointmentSchema.index({ patientId: 1, status: 1 });
AppointmentSchema.index({ doctorId: 1, status: 1 });
AppointmentSchema.index({ facilityId: 1, status: 1 });
AppointmentSchema.index({ sessionId: 1 });

export const Appointment = model<IAppointment>('Appointment', AppointmentSchema);
