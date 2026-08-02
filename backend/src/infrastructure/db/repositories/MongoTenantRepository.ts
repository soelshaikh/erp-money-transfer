import ITenantRepository from '../../../application/ports/ITenantRepository';
import TenantModel from '../models/Tenant.model';
import { NotFoundError } from '../../../domain/errors';

export default class MongoTenantRepository extends ITenantRepository {
  async create(data: any) {
    const doc = await TenantModel.create(data);
    return doc.toObject();
  }

  async findById(id: any) {
    const doc = await TenantModel.findById(id).lean();
    return doc || null;
  }

  async findBySlug(slug: any) {
    const doc = await TenantModel.findOne({ slug }).lean();
    return doc || null;
  }

  async update(id: any, updates: any) {
    const doc = await TenantModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) throw new NotFoundError('Tenant');
    return doc;
  }

  async updateSettings(id: any, settings: any) {
    const setPayload: any = {};
    Object.entries(settings).forEach(([k, v]) => { setPayload[`settings.${k}`] = v; });
    const doc = await TenantModel.findByIdAndUpdate(
      id,
      { $set: setPayload },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) throw new NotFoundError('Tenant');
    return doc;
  }

  async findAll(filters: any = {}) {
    const { status, page = 1, limit = 20 } = filters;
    const query: any = {};
    if (status) query.status = status;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TenantModel.find(query).skip(skip).limit(limit).lean(),
      TenantModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }
}
