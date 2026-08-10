import mongoose from 'mongoose';
import DeviceSessionModel from '../models/DeviceSession.model';
import { DEVICE_STATUS } from '../../../config/constants';

export default class MongoDeviceSessionRepository {
  async findOne(tenantId: string, userId: string, deviceId: string): Promise<any> {
    return DeviceSessionModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId:   new mongoose.Types.ObjectId(userId),
      deviceId,
    }).lean();
  }

  async findById(id: string): Promise<any> {
    return DeviceSessionModel.findById(id).lean();
  }

  async create(data: any): Promise<any> {
    const doc = new DeviceSessionModel(data);
    await doc.save();
    return doc.toObject();
  }

  async update(id: string, updates: any): Promise<any> {
    return DeviceSessionModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean();
  }

  async listByUser(tenantId: string, userId: string, status?: string): Promise<any[]> {
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      userId:   new mongoose.Types.ObjectId(userId),
    };
    if (status) query.status = status;
    return DeviceSessionModel.find(query)
      .populate('userId', 'name username role')
      .sort({ createdAt: -1 })
      .lean();
  }

  async listByTenant(tenantId: string, filters: any = {}): Promise<any[]> {
    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (filters.status) query.status = filters.status;
    if (filters.userId) query.userId = new mongoose.Types.ObjectId(filters.userId);
    return DeviceSessionModel.find(query)
      .populate('userId', 'name username role')
      .sort({ createdAt: -1 })
      .lean();
  }

  async suspendAllExcept(tenantId: string, userId: string, exceptId: string): Promise<void> {
    await DeviceSessionModel.updateMany(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId:   new mongoose.Types.ObjectId(userId),
        _id:      { $ne: new mongoose.Types.ObjectId(exceptId) },
        status:   DEVICE_STATUS.APPROVED,
      },
      { $set: { status: DEVICE_STATUS.SUSPENDED, suspendedAt: new Date() } }
    );
  }

  async suspendAllByUser(tenantId: string, userId: string): Promise<void> {
    await DeviceSessionModel.updateMany(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId:   new mongoose.Types.ObjectId(userId),
        status:   DEVICE_STATUS.APPROVED,
      },
      { $set: { status: DEVICE_STATUS.SUSPENDED, suspendedAt: new Date() } }
    );
  }

  async suspendByDeviceId(tenantId: string, userId: string, deviceId: string): Promise<void> {
    await DeviceSessionModel.updateMany(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId:   new mongoose.Types.ObjectId(userId),
        deviceId,
        status:   DEVICE_STATUS.APPROVED,
      },
      { $set: { status: DEVICE_STATUS.SUSPENDED, suspendedAt: new Date() } }
    );
  }
}
