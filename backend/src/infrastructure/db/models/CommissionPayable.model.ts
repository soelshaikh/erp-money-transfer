import mongoose from 'mongoose';

const commissionPayableSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  fromBranchName: { type: String, required: true },
  fromBranchCode: { type: String, required: true },
  toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  toBranchName: { type: String, required: true },
  toBranchCode: { type: String, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  tokenNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['expected', 'approved', 'pending_settlement', 'in_settlement', 'cancelled', 'reversed', 'settled'], default: 'expected' },
  settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionSettlement', default: null },
}, {
  timestamps: true,
  collection: 'commission_payables',
});

commissionPayableSchema.index({ tenantId: 1, status: 1 });
commissionPayableSchema.index({ tenantId: 1, fromBranchId: 1, status: 1 });
commissionPayableSchema.index({ tenantId: 1, toBranchId: 1, status: 1 });
commissionPayableSchema.index({ tenantId: 1, transactionId: 1 }, { unique: true });

export default mongoose.model('CommissionPayable', commissionPayableSchema);
