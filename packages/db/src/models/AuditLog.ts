import { Schema, model, type Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId?:   Schema.Types.ObjectId;
  action:    string;
  resource:  string;
  metadata:  Record<string, unknown>;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId:   { type: Schema.Types.ObjectId, ref: 'User' },
  action:   { type: String, required: true },
  resource: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ createdAt: 1 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
