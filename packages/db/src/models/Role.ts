import { Schema, model, type Document } from 'mongoose';

export interface IRole extends Document {
  name: 'patient' | 'clinician' | 'admin' | 'specialist';
  description: string;
  permissions: Schema.Types.ObjectId[];
}

const RoleSchema = new Schema<IRole>({
  name:        { type: String, required: true, unique: true, enum: ['patient','clinician','admin','specialist'] },
  description: { type: String, default: '' },
  permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
}, { timestamps: true });

export const Role = model<IRole>('Role', RoleSchema);
