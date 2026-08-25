import UserDaySignOff from '../models/UserDaySignOff.model';
import IUserSignOffRepository from '../../../application/ports/IUserSignOffRepository';

export default class MongoUserSignOffRepository implements IUserSignOffRepository {
  async upsert(data: any): Promise<any> {
    return UserDaySignOff.findOneAndUpdate(
      { tenantId: data.tenantId, userId: data.userId, date: data.date },
      {
        $set: { signedOffAt: data.signedOffAt, reLoginEnabled: false, enabledBy: null, enabledAt: null },
        $setOnInsert: { tenantId: data.tenantId, userId: data.userId, branchId: data.branchId ?? null, date: data.date },
      },
      { upsert: true, new: true }
    ).lean();
  }

  async findByUserAndDate(tenantId: any, userId: any, date: string): Promise<any | null> {
    return UserDaySignOff.findOne({ tenantId, userId, date }).lean();
  }

  async findByDate(tenantId: any, date: string): Promise<any[]> {
    return UserDaySignOff.find({ tenantId, date })
      .populate('userId', 'name username role')
      .populate('branchId', 'name code')
      .populate('enabledBy', 'name username')
      .sort({ signedOffAt: 1 })
      .lean();
  }

  async enableReLogin(tenantId: any, id: any, enabledBy: any): Promise<any | null> {
    return UserDaySignOff.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { reLoginEnabled: true, enabledBy, enabledAt: new Date() } },
      { new: true }
    ).lean();
  }
}
