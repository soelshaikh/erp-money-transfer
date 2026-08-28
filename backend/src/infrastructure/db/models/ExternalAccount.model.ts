import mongoose from 'mongoose';

const externalAccountSchema = new mongoose.Schema({
  tenantId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  branchId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  name:          { type: String, required: true, trim: true },
  code:          { type: String, required: true, trim: true, uppercase: true },
  contactPerson: { type: String, trim: true, default: null },
  phone:         { type: String, trim: true, default: null },
  address:       { type: String, trim: true, default: null },
  notes:         { type: String, trim: true, default: null },
  // positive = they have credit with us (we owe them)
  // negative = they owe us (due outstanding)
  balance:       { type: Number, default: 0 },
  // amount locked by pending-approval transactions
  onHold:        { type: Number, default: 0 },
  status:        { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
  collection: 'external_accounts',
});

externalAccountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
externalAccountSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
externalAccountSchema.index({ tenantId: 1, branchId: 1, status: 1 });

export default mongoose.model('ExternalAccount', externalAccountSchema);
