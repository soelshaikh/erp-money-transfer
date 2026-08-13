import mongoose from 'mongoose';
import IHQCommissionSettlementRepository from '../../../application/ports/IHQCommissionSettlementRepository';
import HQCommissionSettlementModel from '../models/HQCommissionSettlement.model';
import {
  HQCommissionSettlementDoc,
  HQCommissionSettlementCreateData,
  HQSettlementFilters,
  PaginatedSettlements,
} from '../../../domain/types/hqCommission.types';

export default class MongoHQCommissionSettlementRepository extends IHQCommissionSettlementRepository {
  async create(data: HQCommissionSettlementCreateData): Promise<HQCommissionSettlementDoc> {
    const doc = await HQCommissionSettlementModel.create(data);
    return doc.toObject() as HQCommissionSettlementDoc;
  }

  async findAll(tenantId: string, filters: HQSettlementFilters = {}): Promise<PaginatedSettlements> {
    const { branchId, status, page = 1, limit = 30 } = filters;
    const query: Record<string, unknown> = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (branchId) query.branchId = new mongoose.Types.ObjectId(branchId);
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      HQCommissionSettlementModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      HQCommissionSettlementModel.countDocuments(query),
    ]);
    return { data: data as HQCommissionSettlementDoc[], total, page, limit };
  }

  async findById(tenantId: string, id: string): Promise<HQCommissionSettlementDoc | null> {
    return HQCommissionSettlementModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean() as Promise<HQCommissionSettlementDoc | null>;
  }

  async complete(tenantId: string, id: string, completedBy: string, completedByName: string): Promise<HQCommissionSettlementDoc | null> {
    return HQCommissionSettlementModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'pending',
      },
      {
        $set: {
          status: 'completed',
          completedBy: new mongoose.Types.ObjectId(completedBy),
          completedByName,
          completedAt: new Date(),
        },
      },
      { new: true },
    ).lean() as Promise<HQCommissionSettlementDoc | null>;
  }
}
