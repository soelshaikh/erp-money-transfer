import mongoose from 'mongoose';
import { ROLES } from '../../../config/constants';

const userSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  username: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false }, // never returned by default
  role: { type: String, enum: Object.values(ROLES), required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  name: { type: String, required: true, trim: true },
  employeeId: { type: String, default: null },
  status: { type: String, enum: ['active', 'disabled', 'suspended'], default: 'active' },
  loginAllowedFrom: { type: String, default: null }, // "HH:MM"
  loginAllowedTo: { type: String, default: null },   // "HH:MM"
  lastLoginAt: { type: Date, default: null },
  allowedDevices: [{
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: 'Unknown Device' },
    registeredAt: { type: Date, default: Date.now },
  }],
  permissions: {
    canOverrideCommission: { type: Boolean, default: false },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
  collection: 'users',
});

// Law: every compound index MUST start with { tenantId: 1 }
userSchema.index({ tenantId: 1, username: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1, status: 1 });
userSchema.index({ tenantId: 1, branchId: 1, status: 1 });

export default mongoose.model('User', userSchema);
