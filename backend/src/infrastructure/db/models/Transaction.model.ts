import mongoose from 'mongoose';
import { APPROVAL_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, COMMISSION_TYPE, COMMISSION_SIDE } from '../../../config/constants';

// Enterprise-tenant-only snapshot of how commissionAmount was split at the time this
// transaction earned it. Kept on the transaction (rather than only derived from the
// HQCommissionItem) so reports stay accurate even if the tenant's split settings change later.
const commissionSplitSchema = new mongoose.Schema({
  earningBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  ownShareAmount: { type: Number, default: 0 },
  otherBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  otherBranchShareAmount: { type: Number, default: 0 },
  headOfficeOwnShareAmount: { type: Number, default: 0 },
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  tokenNumber: { type: String, required: true }, // e.g. "AHM-20260628-00042"
  collectionBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  payoutBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  amount: { type: Number, required: true, min: 1 }, // rupees
  commissionType: { type: String, enum: Object.values(COMMISSION_TYPE), required: true },
  commissionValue: { type: Number, required: true },
  commissionAmount: { type: Number, required: true },
  commissionSide: { type: String, enum: Object.values(COMMISSION_SIDE), required: true, default: COMMISSION_SIDE.COLLECTION },
  finalAmount: { type: Number, required: true }, // payout side: amount−commission; collection side: full amount (receiver gets all)
  approvalStatus: {
    type: String,
    enum: Object.values(APPROVAL_STATUS),
    default: APPROVAL_STATUS.PENDING,
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), default: PAYMENT_METHOD.CASH },
  collectionPhotoUrl: { type: String, default: null },
  payoutPhotoUrl: { type: String, default: null },
  remarks: { type: String, default: null },
  customerTokenNo: { type: String, default: null },
  externalAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalAccount', default: null },
  partnerCoveredAmount: { type: Number, default: 0 },
  // Receiver-side partner (Lenar) — separate from externalAccountId (sender-side/Mokalnar).
  // Balance moves at payout completion, not at creation — see CompletePayment.ts.
  payoutExternalAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalAccount', default: null },
  commissionSplit: { type: commissionSplitSchema, default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  collection: 'transactions',
});

// Primary query patterns — all start with tenantId
transactionSchema.index({ tenantId: 1, tokenNumber: 1 }, { unique: true });
transactionSchema.index({ tenantId: 1, approvalStatus: 1, createdAt: -1 });
transactionSchema.index({ tenantId: 1, paymentStatus: 1, createdAt: -1 });
transactionSchema.index({ tenantId: 1, collectionBranchId: 1, createdAt: -1 });
transactionSchema.index({ tenantId: 1, payoutBranchId: 1, createdAt: -1 });
transactionSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('Transaction', transactionSchema);
