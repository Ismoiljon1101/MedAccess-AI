import { Schema, model, type Document } from 'mongoose';

export interface ICondition extends Document {
  patientId:   Schema.Types.ObjectId;
  name:        string;
  diagnosedAt?: Date;
}

const ConditionSchema = new Schema<ICondition>({
  patientId:   { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  name:        { type: String, required: true },
  diagnosedAt: { type: Date },
}, { timestamps: true });

export const Condition = model<ICondition>('Condition', ConditionSchema);
