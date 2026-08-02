import mongoose from 'mongoose';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

const auditLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true },
  module: { type: String, enum: Object.values(MODULES), required: true },
  entityId: { type: String, default: null }, // string to support any ObjectId or token
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  actorName: { type: String, default: null },
  actorUsername: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'audit_logs',
});

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, module: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
