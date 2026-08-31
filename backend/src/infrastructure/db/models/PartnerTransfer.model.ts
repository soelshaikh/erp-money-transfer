import mongoose from 'mongoose';

const partnerTransferSchema = new mongoose.Schema({
  tenantId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  externalAccountId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalAccount', required: true },
  fromBranchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  toBranchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  amount:             { type: Number, required: true },
  finalAmount:        { type: Number, required: true, default: 0 },
  partnerCoversAmount: { type: Number, default: 0 },
  branchCoversAmount:  { type: Number, default: 0 },
  commissionSide:     { type: String, enum: ['none', 'collection', 'payout', 'payout_extra'], default: 'none' },
  commissionType:     { type: String, enum: ['flat', 'percentage'], default: 'flat' },
  commissionValue:    { type: Number, default: 0 },
  commissionAmount:   { type: Number, default: 0 },
  paymentMethod:      { type: String, enum: ['cash', 'neft', 'rtgs', 'imps'], default: 'cash' },
  // pending → approved → completed | pending → rejected | pending/approved → cancelled
  status:             { type: String, enum: ['pending', 'approved', 'completed', 'cancelled', 'rejected'], default: 'pending' },
  senderName:         { type: String, trim: true, default: null },
  senderMobile:       { type: String, trim: true, default: null },
  receiverName:       { type: String, trim: true, default: null },
  receiverMobile:     { type: String, trim: true, default: null },
  customerTokenNo:    { type: String, trim: true, default: null },
  remarks:            { type: String, trim: true, default: null },
  rejectionReason:    { type: String, trim: true, default: null },
  cancellationReason: { type: String, trim: true, default: null },
  createdByRole:      { type: String, enum: ['branch', 'head_office'], required: true },
  transferRef:        { type: String, required: true },
  createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName:      { type: String, default: null },
  approvedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedByName:     { type: String, default: null },
  completedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completedByName:    { type: String, default: null },
  cancelledBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledByName:    { type: String, default: null },
  rejectedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedByName:     { type: String, default: null },
  approvedAt:         { type: Date, default: null },
  completedAt:        { type: Date, default: null },
  cancelledAt:        { type: Date, default: null },
  rejectedAt:         { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'partner_transfers',
});

partnerTransferSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
partnerTransferSchema.index({ tenantId: 1, externalAccountId: 1, createdAt: -1 });
partnerTransferSchema.index({ tenantId: 1, fromBranchId: 1, createdAt: -1 });
partnerTransferSchema.index({ tenantId: 1, toBranchId: 1, createdAt: -1 });
partnerTransferSchema.index({ tenantId: 1, transferRef: 1 }, { unique: true });

export default mongoose.model('PartnerTransfer', partnerTransferSchema);
