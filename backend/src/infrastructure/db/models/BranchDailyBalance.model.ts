import mongoose from 'mongoose';

const branchDailyBalanceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD (UTC)
  openingBalance: { type: Number, required: true, default: 0 },
  closingBalance: { type: Number, required: true, default: 0 },
}, {
  timestamps: true,
  collection: 'branch_daily_balances',
});

branchDailyBalanceSchema.index({ tenantId: 1, branchId: 1, date: 1 }, { unique: true });
branchDailyBalanceSchema.index({ tenantId: 1, branchId: 1, date: -1 });

export default mongoose.model('BranchDailyBalance', branchDailyBalanceSchema);
