import mongoose from 'mongoose';
import { PAYMENT_METHOD } from '../../../config/constants';

const hqCommissionSettlementSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  branchName: { type: String, required: true },
  branchCode: { type: String, required: true },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HQCommissionItem' }],
  itemCount: { type: Number, required: true },
  totalCommission: { type: Number, required: true },    // sum of commissionAmounts (branch earned total)
  totalHQShare: { type: Number, required: true },        // sum of hqShareAmounts (branch pays to HO)
  paymentMode: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  notes: { type: String, default: null },
  initiatedBySide: { type: String, enum: ['branch', 'head_office'], required: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  initiatedByName: { type: String, required: true },
  initiatedAt: { type: Date, required: true },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completedByName: { type: String, default: null },
  completedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'hq_commission_settlements',
});

hqCommissionSettlementSchema.index({ tenantId: 1, status: 1 });
hqCommissionSettlementSchema.index({ tenantId: 1, branchId: 1, status: 1 });

export default mongoose.model('HQCommissionSettlement', hqCommissionSettlementSchema);
