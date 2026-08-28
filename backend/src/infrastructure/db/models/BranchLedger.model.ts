import mongoose from 'mongoose';

const branchLedgerSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  type: { type: String, enum: ['credit', 'debit', 'committed_debit', 'pending_debit', 'pending_reversed'], required: true },
  amount: { type: Number, required: true }, // always positive
  // Actual balance (real money)
  actualBalanceBefore: { type: Number, required: true },
  actualBalanceAfter: { type: Number, required: true },
  // Effective balance (actual − committed)
  effectiveBalanceBefore: { type: Number, required: true },
  effectiveBalanceAfter: { type: Number, required: true },
  description: { type: String, required: true },
  event: {
    type: String,
    enum: [
      'collection', 'payout_committed', 'payout_completed', 'collection_reversed',
      'pending_payout', 'pending_payout_reversed', 'commission_earned',
      'commission_payable', 'commission_receivable',
      'commission_settlement_out', 'commission_settlement_in',
      'hq_commission_out', 'hq_commission_in',
      'partner_deposit', 'partner_due',
    ],
    required: true,
  },
  tokenNumber: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'branch_ledger',
});

branchLedgerSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
branchLedgerSchema.index({ tenantId: 1, transactionId: 1 });

export default mongoose.model('BranchLedger', branchLedgerSchema);
