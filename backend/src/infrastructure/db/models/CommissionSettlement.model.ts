import mongoose from 'mongoose';

const commissionSettlementSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  fromBranchName: { type: String, required: true },
  fromBranchCode: { type: String, required: true },
  toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  toBranchName: { type: String, required: true },
  toBranchCode: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  transactionCount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  payableIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommissionPayable' }],
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  initiatedByName: { type: String, required: true },
  initiatedAt: { type: Date, required: true },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completedByName: { type: String, default: null },
  completedAt: { type: Date, default: null },
  notes: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'commission_settlements',
});

commissionSettlementSchema.index({ tenantId: 1, status: 1 });
commissionSettlementSchema.index({ tenantId: 1, fromBranchId: 1, status: 1 });
commissionSettlementSchema.index({ tenantId: 1, toBranchId: 1, status: 1 });

export default mongoose.model('CommissionSettlement', commissionSettlementSchema);
