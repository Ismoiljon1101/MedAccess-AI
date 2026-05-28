import { Schema, model, type Document } from 'mongoose';

export interface ITimeSlot extends Document {
  doctorId: string;    // seed IDs ('d1'…) or real ObjectId strings
  facilityId: string;  // seed IDs ('f1'…) or real ObjectId strings
  date: string;        // 'YYYY-MM-DD' — simple string for easy querying
  startTime: string;   // 'HH:MM'
  endTime: string;     // 'HH:MM'
  isBooked: boolean;
  appointmentId?: Schema.Types.ObjectId;
}

const TimeSlotSchema = new Schema<ITimeSlot>({
  doctorId:      { type: String, required: true },   // seed IDs or real ObjectId strings
  facilityId:    { type: String, required: true },   // seed IDs or real ObjectId strings
  date:          { type: String, required: true },  // 'YYYY-MM-DD'
  startTime:     { type: String, required: true },  // 'HH:MM'
  endTime:       { type: String, required: true },  // 'HH:MM'
  isBooked:      { type: Boolean, default: false },
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
}, { timestamps: true });

TimeSlotSchema.index({ doctorId: 1, date: 1, isBooked: 1 });
TimeSlotSchema.index({ facilityId: 1, date: 1 });

export const TimeSlot = model<ITimeSlot>('TimeSlot', TimeSlotSchema);
