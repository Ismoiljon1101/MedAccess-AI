import { Schema, model, type Document } from 'mongoose';

export type AccountRole = 'doctor' | 'pharmacist' | 'admin';

export interface IAccount extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: AccountRole;
  // Provider context
  facilityId?: Schema.Types.ObjectId;  // clinic this account belongs to
  doctorId?: Schema.Types.ObjectId;    // linked Doctor doc (bookable doctors)
  specialty?: string;                  // doctor
  occupation?: string;                 // pharmacist / admin title
  clinicName?: string;
  active: boolean;
}

const AccountSchema = new Schema<IAccount>({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, required: true, trim: true },
  role:         { type: String, enum: ['doctor', 'pharmacist', 'admin'], required: true },
  facilityId:   { type: Schema.Types.ObjectId, ref: 'Facility' },
  doctorId:     { type: Schema.Types.ObjectId, ref: 'Doctor' },
  specialty:    { type: String },
  occupation:   { type: String },
  clinicName:   { type: String },
  active:       { type: Boolean, default: true },
}, { timestamps: true });

export const Account = model<IAccount>('Account', AccountSchema);
