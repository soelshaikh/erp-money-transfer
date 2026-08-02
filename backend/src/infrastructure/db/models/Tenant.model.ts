import mongoose from 'mongoose';

const brandingSchema = new mongoose.Schema({
  appName: { type: String, default: 'Money Transfer' },
  logoUrl: { type: String, default: null },
  primaryColor: { type: String, default: '#1A73E8' },
  secondaryColor: { type: String, default: '#34A853' },
}, { _id: false });

const featuresSchema = new mongoose.Schema({
  customerVerification: { type: Boolean, default: true },
  otpForPayout: { type: Boolean, default: true },
  reportExport: { type: Boolean, default: true },
  smsNotifications: { type: Boolean, default: true },
  deviceApprovalRequired: { type: Boolean, default: false },
  exportFormats: { type: [String], default: ['csv', 'excel', 'pdf'] },
}, { _id: false });

const commissionSchema = new mongoose.Schema({
  type: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
  value: { type: Number, default: 0 },
}, { _id: false });

const transactionLimitsSchema = new mongoose.Schema({
  maxAmountPerTransaction: { type: Number, default: 0 }, // 0 = no limit
  dailyLimitPerBranch: { type: Number, default: 0 },     // 0 = no limit, in rupees
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  otpExpiryMinutes: { type: Number, default: 10 },
  smsTemplateId: { type: String, default: null },
  commission: { type: commissionSchema, default: () => ({}) },
  timezone: { type: String, default: 'Asia/Kolkata' },
  loginTimeRestriction: { type: Boolean, default: false },
  transactionLimits: { type: transactionLimitsSchema, default: () => ({}) },
}, { _id: false });

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  contactEmail: { type: String, trim: true, lowercase: true },
  contactPhone: { type: String, trim: true },
  address: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  branding: { type: brandingSchema, default: () => ({}) },
  features: { type: featuresSchema, default: () => ({}) },
  settings: { type: settingsSchema, default: () => ({}) },
  branchLimit: { type: Number, required: true, default: 99, min: 1 },
  staffLimit: { type: Number, required: true, default: 99, min: 1 },
  subscriptionExpiresAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'tenants',
});

tenantSchema.index({ status: 1 });

export default mongoose.model('Tenant', tenantSchema);
