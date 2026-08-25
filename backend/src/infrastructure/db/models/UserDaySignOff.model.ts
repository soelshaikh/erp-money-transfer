import mongoose from 'mongoose';

const userDaySignOffSchema = new mongoose.Schema({
  tenantId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  branchId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  date:            { type: String, required: true }, // YYYY-MM-DD IST
  signedOffAt:     { type: Date, required: true },
  reLoginEnabled:  { type: Boolean, default: false },
  enabledBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  enabledAt:       { type: Date, default: null },
}, {
  timestamps: false,
  collection: 'user_day_sign_offs',
});

userDaySignOffSchema.index({ tenantId: 1, userId: 1, date: 1 }, { unique: true });
userDaySignOffSchema.index({ tenantId: 1, date: 1 });

export default mongoose.model('UserDaySignOff', userDaySignOffSchema);
