import { Schema, model, type Document } from 'mongoose';

export interface ITimeSlot extends Document {
  doctorId: Schema.Types.ObjectId;
  facilityId: Schema.Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  appointmentId?: Schema.Types.ObjectId;
}

const TimeSlotSchema = new Schema<ITimeSlot>({
  doctorId:      { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  facilityId:    { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
  date:          { type: String, required: true },
  startTime:     { type: String, required: true },
  endTime:       { type: String, required: true },
  isBooked:      { type: Boolean, default: false },
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
}, { timestamps: true });

TimeSlotSchema.index({ doctorId: 1, date: 1, isBooked: 1 });
TimeSlotSchema.index({ facilityId: 1, date: 1 });
// One physical slot per doctor/date/time — backstops the double-booking race in book().
TimeSlotSchema.index({ doctorId: 1, date: 1, startTime: 1 }, { unique: true });

export const TimeSlot = model<ITimeSlot>('TimeSlot', TimeSlotSchema);
