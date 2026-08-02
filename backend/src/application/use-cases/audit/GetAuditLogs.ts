import mongoose from 'mongoose';
import AuditLogModel from '../../../infrastructure/db/models/AuditLog.model';

export default class GetAuditLogs {
  async execute(params: any): Promise<any> {
    const { tenantId, page = 1, limit = 20, module, action, userId, dateFrom, dateTo } = params;

    const filter: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (module) filter.module = module;
    if (action) filter.action = action;
    if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / Number(limit));

    return { logs, total, page: Number(page), pages };
  }
}
