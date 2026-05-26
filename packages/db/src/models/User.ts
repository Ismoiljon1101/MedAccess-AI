import { Schema, model, type Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  roleId: Schema.Types.ObjectId;
  clinicId?: Schema.Types.ObjectId;
  locale: string;
  lastLoginAt?: Date;
}

const UserSchema = new Schema<IUser>({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  roleId:       { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  clinicId:     { type: Schema.Types.ObjectId, ref: 'Clinic' },
  locale:       { type: String, default: 'English' },
  lastLoginAt:  { type: Date },
}, { timestamps: true });

UserSchema.index({ clinicId: 1 });

export const User = model<IUser>('User', UserSchema);
