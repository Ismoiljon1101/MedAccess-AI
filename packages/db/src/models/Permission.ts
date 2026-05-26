import { Schema, model, type Document } from 'mongoose';

export interface IPermission extends Document {
  resource: 'patient' | 'encounter' | 'audit' | 'report' | 'clinic';
  action: 'read' | 'write' | 'delete' | 'sign';
}

const PermissionSchema = new Schema<IPermission>({
  resource: { type: String, required: true, enum: ['patient','encounter','audit','report','clinic'] },
  action:   { type: String, required: true, enum: ['read','write','delete','sign'] },
}, { timestamps: true });

PermissionSchema.index({ resource: 1, action: 1 }, { unique: true });

export const Permission = model<IPermission>('Permission', PermissionSchema);
