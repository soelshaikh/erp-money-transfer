import mongoose from 'mongoose';
import ICommissionPayableRepository from '../../../application/ports/ICommissionPayableRepository';
import CommissionPayableModel from '../models/CommissionPayable.model';

export default class MongoCommissionPayableRepository extends ICommissionPayableRepository {
  async create(data: any) {
    const doc = await CommissionPayableModel.create(data);
    return doc.toObject();
  }

  async findPending(tenantId: string, fromBranchId?: string, toBranchId?: string) {
    const query: any = { tenantId, status: 'pending', settlementId: null };
    if (fromBranchId) query.fromBranchId = new mongoose.Types.ObjectId(fromBranchId);
    if (toBranchId) query.toBranchId = new mongoose.Types.ObjectId(toBranchId);
    return CommissionPayableModel.find(query).sort({ createdAt: 1 }).lean();
  }

  async findAll(tenantId: string, filters: any = {}) {
    const { page = 1, limit = 30, fromBranchId, toBranchId, status, fromDate, toDate } = filters;
    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (fromBranchId) query.fromBranchId = new mongoose.Types.ObjectId(fromBranchId);
    if (toBranchId) query.toBranchId = new mongoose.Types.ObjectId(toBranchId);
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(`${fromDate}T00:00:00+05:30`);
      if (toDate) query.createdAt.$lte = new Date(`${toDate}T23:59:59+05:30`);
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      CommissionPayableModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CommissionPayableModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  // Mark payables as reserved (linked to a pending settlement) to prevent double-settlement
  async reserveForSettlement(tenantId: string, ids: string[], settlementId: string) {
    await CommissionPayableModel.updateMany(
      { tenantId, _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }, status: 'pending', settlementId: null },
      { $set: { settlementId: new mongoose.Types.ObjectId(settlementId) } },
    );
  }

  async markSettled(tenantId: string, ids: string[]) {
    await CommissionPayableModel.updateMany(
      { tenantId, _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) } },
      { $set: { status: 'settled' } },
    );
  }

  // Release payables back to pending if a settlement is cancelled (future use)
  async releaseFromSettlement(tenantId: string, settlementId: string) {
    await CommissionPayableModel.updateMany(
      { tenantId, settlementId: new mongoose.Types.ObjectId(settlementId), status: 'pending' },
      { $set: { settlementId: null } },
    );
  }

  // Returns grouped totals: how much each fromBranch owes each toBranch
  async getPendingSummary(tenantId: string) {
    return CommissionPayableModel.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: 'pending', settlementId: null } },
      {
        $group: {
          _id: { fromBranchId: '$fromBranchId', toBranchId: '$toBranchId' },
          fromBranchName: { $first: '$fromBranchName' },
          fromBranchCode: { $first: '$fromBranchCode' },
          toBranchName: { $first: '$toBranchName' },
          toBranchCode: { $first: '$toBranchCode' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          oldestAt: { $min: '$createdAt' },
        },
      },
      { $sort: { oldestAt: 1 } },
    ]);
  }
}
