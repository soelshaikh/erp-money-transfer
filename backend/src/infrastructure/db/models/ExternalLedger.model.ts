import mongoose from 'mongoose';

const externalLedgerSchema = new mongoose.Schema({
  tenantId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  externalAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalAccount', required: true },
  // deposit = they brought cash to us  (credit → balance +)
  // due     = they owe us money        (debit  → balance −)
  // adjustment = manual correction     (direction determines sign)
  type:              { type: String, enum: ['deposit', 'due', 'adjustment'], required: true },
  direction:         { type: String, enum: ['credit', 'debit'], required: true },
  amount:            { type: Number, required: true },  // always positive paisa
  balanceBefore:     { type: Number, required: true },
  balanceAfter:      { type: Number, required: true },
  description:       { type: String, trim: true, default: null },
  entryDate:         { type: String, required: true },  // YYYY-MM-DD
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName:     { type: String, default: null },
}, {
  timestamps: true,
  collection: 'external_ledger',
});

externalLedgerSchema.index({ tenantId: 1, externalAccountId: 1, createdAt: -1 });
externalLedgerSchema.index({ tenantId: 1, entryDate: -1 });

export default mongoose.model('ExternalLedger', externalLedgerSchema);
