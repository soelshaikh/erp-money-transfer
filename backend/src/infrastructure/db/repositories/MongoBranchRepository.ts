import IBranchRepository from '../../../application/ports/IBranchRepository';
import BranchModel from '../models/Branch.model';
import { NotFoundError } from '../../../domain/errors';

export default class MongoBranchRepository extends IBranchRepository {
  async create(data: any) {
    const doc = await BranchModel.create(data);
    return doc.toObject();
  }

  async findById(tenantId: any, id: any) {
    const doc = await BranchModel.findOne({ _id: id, tenantId }).lean();
    return doc || null;
  }

  async findByCode(tenantId: any, code: any) {
    const doc = await BranchModel.findOne({ tenantId, code: code.toUpperCase() }).lean();
    return doc || null;
  }

  async update(tenantId: any, id: any, updates: any) {
    const doc = await BranchModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) throw new NotFoundError('Branch');
    return doc;
  }

  async findAll(tenantId: any, filters: any = {}) {
    const { type, status, page = 1, limit = 20 } = filters;
    const query: any = { tenantId };
    if (type) query.type = type;
    if (status) query.status = status;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      BranchModel.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      BranchModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  async findAllActive(tenantId: any) {
    return BranchModel.find({ tenantId, status: 'active' }).sort({ name: 1 }).lean();
  }

  async countNonHeadOffice(tenantId: any): Promise<number> {
    return BranchModel.countDocuments({ tenantId, type: { $ne: 'head_office' } });
  }

  async findHeadOfficeBranch(tenantId: string): Promise<any | null> {
    return BranchModel.findOne({ tenantId, type: 'head_office' }).lean();
  }

  async hasSpecificBranch(tenantId: string): Promise<boolean> {
    const count = await BranchModel.countDocuments({ tenantId, isSpecific: true });
    return count > 0;
  }
}
