import mongoose from 'mongoose';
import { NOTIFICATION_TYPE } from '../../../config/constants';

const notificationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: null }, // e.g. { transactionId, tokenNumber }
  isRead: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'notifications',
});

notificationSchema.index({ tenantId: 1, userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
