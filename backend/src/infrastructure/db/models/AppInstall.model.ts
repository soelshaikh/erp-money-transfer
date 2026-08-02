import mongoose from 'mongoose';

const appInstallSchema = new mongoose.Schema({
  deviceId:   { type: String, required: true, unique: true },
  deviceName: { type: String, default: 'Unknown' },
  platform:   { type: String, default: 'unknown' },
  appVersion: { type: String, default: null },
  ip:         { type: String, default: null },
  userAgent:  { type: String, default: null },
}, {
  timestamps: true,
  collection: 'app_installs',
});

appInstallSchema.index({ createdAt: -1 });

export default mongoose.model('AppInstall', appInstallSchema);
