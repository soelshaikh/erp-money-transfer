import mongoose from 'mongoose';
import { APP_ACCESS_STATUS } from '../../../config/constants';

const appInstallSchema = new mongoose.Schema({
  deviceId:   { type: String, required: true, unique: true },
  deviceName: { type: String, default: 'Unknown' },
  platform:   { type: String, default: 'unknown' },
  appVersion: { type: String, default: null },
  ip:         { type: String, default: null },
  userAgent:  { type: String, default: null },
  status:     { type: String, enum: Object.values(APP_ACCESS_STATUS), default: APP_ACCESS_STATUS.PENDING },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'app_installs',
});

appInstallSchema.index({ createdAt: -1 });
appInstallSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('AppInstall', appInstallSchema);
