import IUserRepository from '../../../application/ports/IUserRepository';
import UserModel from '../models/User.model';
import { NotFoundError } from '../../../domain/errors';

export default class MongoUserRepository extends IUserRepository {
  async create(data: any) {
    const doc = await UserModel.create(data);
    return doc.toObject();
  }

  async findById(tenantId: any, id: any) {
    const doc = await UserModel.findOne({ _id: id, tenantId }).lean();
    return doc || null;
  }

  async findByUsername(tenantId: any, username: any) {
    // +passwordHash explicitly selects the excluded field
    const doc = await UserModel.findOne({ tenantId, username: username.toLowerCase() })
      .select('+passwordHash')
      .lean();
    return doc || null;
  }

  async update(tenantId: any, id: any, updates: any) {
    const doc = await UserModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) throw new NotFoundError('User');
    return doc;
  }

  async updatePassword(tenantId: any, id: any, passwordHash: any) {
    const result = await UserModel.updateOne({ _id: id, tenantId }, { $set: { passwordHash } });
    if (result.matchedCount === 0) throw new NotFoundError('User');
  }

  async updateLastLogin(tenantId: any, id: any) {
    await UserModel.updateOne({ _id: id, tenantId }, { $set: { lastLoginAt: new Date() } });
  }

  async findAll(tenantId: any, filters: any = {}) {
    const { role, branchId, status, page = 1, limit = 20 } = filters;
    const query: any = { tenantId };
    if (role) query.role = role;
    if (branchId) query.branchId = branchId;
    if (status) query.status = status;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      UserModel.find(query).skip(skip).limit(limit).lean(),
      UserModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  async usernameExists(tenantId: any, username: any) {
    const count = await UserModel.countDocuments({ tenantId, username: username.toLowerCase() });
    return count > 0;
  }

  async addDevice(tenantId: any, userId: any, device: any) {
    // Only add if this deviceId is not already in the list
    await UserModel.updateOne(
      { _id: userId, tenantId, 'allowedDevices.deviceId': { $ne: device.deviceId } },
      { $push: { allowedDevices: device } }
    );
  }

  async removeDevice(tenantId: any, userId: any, deviceId: any) {
    const result = await UserModel.updateOne(
      { _id: userId, tenantId },
      { $pull: { allowedDevices: { deviceId } } }
    );
    if (result.matchedCount === 0) throw new NotFoundError('User');
  }

  async countActiveByTenant(tenantId: string): Promise<number> {
    return UserModel.countDocuments({ tenantId, status: 'active' });
  }

  async getDevices(tenantId: any, userId: any) {
    const user = await UserModel.findOne({ _id: userId, tenantId }, { allowedDevices: 1 }).lean();
    if (!user) throw new NotFoundError('User');
    return (user as any).allowedDevices || [];
  }

  async clearAllowedDevices(tenantId: any, userId: any): Promise<void> {
    await UserModel.updateOne(
      { _id: userId, tenantId },
      { $set: { allowedDevices: [] } }
    );
  }

  async countActiveByBranch(tenantId: string, branchId: string): Promise<number> {
    return UserModel.countDocuments({ tenantId, branchId, status: 'active' });
  }
}
