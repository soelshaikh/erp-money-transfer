import mongoose from 'mongoose';
import ICommissionSettlementRepository from '../../../application/ports/ICommissionSettlementRepository';
import CommissionSettlementModel from '../models/CommissionSettlement.model';

export default class MongoCommissionSettlementRepository extends ICommissionSettlementRepository {
  async create(data: any) {
    const doc = await CommissionSettlementModel.create(data);
    return doc.toObject();
  }

  async findById(tenantId: string, id: string) {
    return CommissionSettlementModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean();
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
      CommissionSettlementModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CommissionSettlementModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  async complete(tenantId: string, id: string, completedBy: string, completedByName: string) {
    return CommissionSettlementModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId), status: 'pending' },
      { $set: { status: 'completed', completedBy: new mongoose.Types.ObjectId(completedBy), completedByName, completedAt: new Date() } },
      { new: true },
    ).lean();
  }
}
