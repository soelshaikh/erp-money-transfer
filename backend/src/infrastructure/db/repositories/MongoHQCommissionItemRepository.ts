import mongoose from 'mongoose';
import IHQCommissionItemRepository from '../../../application/ports/IHQCommissionItemRepository';
import HQCommissionItemModel from '../models/HQCommissionItem.model';
import {
  HQCommissionItemDoc,
  HQCommissionItemCreateData,
} from '../../../domain/types/hqCommission.types';

export default class MongoHQCommissionItemRepository extends IHQCommissionItemRepository {
  async create(data: HQCommissionItemCreateData): Promise<HQCommissionItemDoc> {
    const doc = await HQCommissionItemModel.create(data);
    return doc.toObject() as HQCommissionItemDoc;
  }

  async findPending(tenantId: string, branchId?: string): Promise<HQCommissionItemDoc[]> {
    const query: Record<string, unknown> = { tenantId, status: 'pending' };
    if (branchId) query.branchId = new mongoose.Types.ObjectId(branchId);
    return HQCommissionItemModel.find(query).sort({ createdAt: -1 }).lean() as Promise<HQCommissionItemDoc[]>;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<HQCommissionItemDoc[]> {
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
    return HQCommissionItemModel.find({ tenantId, _id: { $in: objectIds } }).lean() as Promise<HQCommissionItemDoc[]>;
  }

  async markInSettlement(tenantId: string, ids: string[], settlementId: string): Promise<void> {
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
    await HQCommissionItemModel.updateMany(
      { tenantId, _id: { $in: objectIds } },
      { $set: { status: 'in_settlement', settlementId: new mongoose.Types.ObjectId(settlementId) } },
    );
  }

  async markSettled(tenantId: string, ids: string[]): Promise<void> {
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
    await HQCommissionItemModel.updateMany(
      { tenantId, _id: { $in: objectIds } },
      { $set: { status: 'settled' } },
    );
  }

  async findBySettlement(tenantId: string, settlementId: string): Promise<HQCommissionItemDoc[]> {
    return HQCommissionItemModel.find({
      tenantId,
      settlementId: new mongoose.Types.ObjectId(settlementId),
    }).sort({ createdAt: -1 }).lean() as Promise<HQCommissionItemDoc[]>;
  }

  async findByTransactionId(tenantId: string, transactionId: string): Promise<HQCommissionItemDoc | null> {
    return HQCommissionItemModel.findOne({
      tenantId,
      transactionId: new mongoose.Types.ObjectId(transactionId),
    }).lean() as Promise<HQCommissionItemDoc | null>;
  }
}
