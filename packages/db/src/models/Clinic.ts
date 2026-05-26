import { Schema, model, type Document } from 'mongoose';

export interface IClinic extends Document {
  name: string;
  country: string;
  language: string;
  settings: Record<string, unknown>;
}

const ClinicSchema = new Schema<IClinic>({
  name:     { type: String, required: true },
  country:  { type: String, default: '' },
  language: { type: String, default: 'English' },
  settings: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export const Clinic = model<IClinic>('Clinic', ClinicSchema);
