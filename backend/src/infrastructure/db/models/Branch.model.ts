import mongoose from 'mongoose';
import { BRANCH_TYPES, BRANCH_STATUS } from '../../../domain/entities/Branch';

const branchSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true }, // e.g. "AHM"
  type: { type: String, enum: Object.values(BRANCH_TYPES), required: true },
  contactPerson: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },
  status: { type: String, enum: Object.values(BRANCH_STATUS), default: BRANCH_STATUS.ACTIVE },
  balance: { type: Number, default: 0 },             // actual cash in/out
  committedPayout: { type: Number, default: 0 },    // approved but not yet paid out
  pendingPayout: { type: Number, default: 0 },      // created but not yet approved
  payoutCompleted: { type: Number, default: 0 },    // total paid out (offsets balance in effective calc)
  commissionPayable: { type: Number, default: 0 },  // commission collected on behalf of sending branch (flag ON, payout side)
  commissionReceivable: { type: Number, default: 0 }, // commission earned from payout branch not yet received (flag ON, collection side)
  commissionConfig: {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
    value: { type: Number, default: 0 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
  collection: 'branches',
});

branchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, type: 1, status: 1 });
branchSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('Branch', branchSchema);
