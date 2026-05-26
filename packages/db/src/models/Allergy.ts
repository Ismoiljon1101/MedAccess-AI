import { Schema, model, type Document } from 'mongoose';

export interface IAllergy extends Document {
  patientId: Schema.Types.ObjectId;
  allergen: string;
}

const AllergySchema = new Schema<IAllergy>({
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  allergen:  { type: String, required: true },
}, { timestamps: true });

export const Allergy = model<IAllergy>('Allergy', AllergySchema);
