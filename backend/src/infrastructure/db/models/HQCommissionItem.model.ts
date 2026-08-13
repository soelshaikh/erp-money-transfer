import mongoose from 'mongoose';

const hqCommissionItemSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  branchName: { type: String, required: true },
  branchCode: { type: String, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  tokenNumber: { type: String, required: true },
  commissionAmount: { type: Number, required: true },   // full commission earned by branch on this txn
  hqSharePct: { type: Number, required: true },          // snapshot of masterCommissionPct at creation
  hqShareAmount: { type: Number, required: true },       // Math.round(commissionAmount * hqSharePct / 100)
  status: { type: String, enum: ['pending', 'in_settlement', 'settled'], default: 'pending' },
  settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'HQCommissionSettlement', default: null },
}, {
  timestamps: true,
  collection: 'hq_commission_items',
});

hqCommissionItemSchema.index({ tenantId: 1, branchId: 1, status: 1 });
hqCommissionItemSchema.index({ tenantId: 1, transactionId: 1 }, { unique: true });
hqCommissionItemSchema.index({ tenantId: 1, settlementId: 1 });

export default mongoose.model('HQCommissionItem', hqCommissionItemSchema);
