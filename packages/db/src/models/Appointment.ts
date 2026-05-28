import { Schema, model, type Document } from 'mongoose';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface IAppointment extends Document {
  // Patient info (captured at booking — no auth in v0.1)
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientAge?: number;
  patientSex?: 'male' | 'female' | 'other';

  // Booking references
  slotId: Schema.Types.ObjectId;
  doctorId: Schema.Types.ObjectId;
  facilityId: Schema.Types.ObjectId;

  // Context from MA Agent
  specialty: string;
  urgency: string;
  maAgentSummary?: string;  // AI-generated report attached to appointment
  sessionId?: string;

  // Workflow
  status: AppointmentStatus;
  doctorNotes?: string;     // added by doctor during/after encounter
  confirmedAt?: Date;
  completedAt?: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
  patientName:     { type: String, required: true, trim: true },
  patientPhone:    { type: String },
  patientEmail:    { type: String },
  patientAge:      { type: Number },
  patientSex:      { type: String, enum: ['male', 'female', 'other'] },

  slotId:          { type: Schema.Types.ObjectId, ref: 'TimeSlot',  required: true },
  doctorId:        { type: Schema.Types.ObjectId, ref: 'Doctor',    required: true },
  facilityId:      { type: Schema.Types.ObjectId, ref: 'Facility',  required: true },

  specialty:       { type: String, required: true },
  urgency:         { type: String, default: 'see-clinician-soon' },
  maAgentSummary:  { type: String, maxlength: 4000 },
  sessionId:       { type: String },

  status:          { type: String, enum: ['pending','confirmed','cancelled','completed'], default: 'pending' },
  doctorNotes:     { type: String, maxlength: 4000 },
  confirmedAt:     { type: Date },
  completedAt:     { type: Date },
}, { timestamps: true });

AppointmentSchema.index({ doctorId: 1, status: 1 });
AppointmentSchema.index({ facilityId: 1, status: 1 });
AppointmentSchema.index({ sessionId: 1 });

export const Appointment = model<IAppointment>('Appointment', AppointmentSchema);
