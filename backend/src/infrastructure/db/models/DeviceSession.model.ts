import mongoose from 'mongoose';
import { DEVICE_STATUS } from '../../../config/constants';

const deviceSessionSchema = new mongoose.Schema({
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  deviceId:    { type: String, required: true },
  deviceName:  { type: String, default: 'Unknown Device' },
  platform:    { type: String, default: 'unknown' },
  ip:          { type: String, default: null },
  userAgent:   { type: String, default: null },
  status:      { type: String, enum: Object.values(DEVICE_STATUS), default: DEVICE_STATUS.PENDING },
  attemptCount:  { type: Number, default: 0 },
  lastAttemptAt: { type: Date,   default: null },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:  { type: Date, default: null },
  rejectedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt:  { type: Date, default: null },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspendedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'device_sessions',
});

deviceSessionSchema.index({ tenantId: 1, userId: 1, deviceId: 1 }, { unique: true });
deviceSessionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
deviceSessionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

export default mongoose.model('DeviceSession', deviceSessionSchema);
