import AuditLogModel from '../../../infrastructure/db/models/AuditLog.model';
import UserModel from '../../../infrastructure/db/models/User.model';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class GetLoginReport {
  async execute({ tenantId, startDate, endDate, userId, role, branchId }: any) {
    const filter: any = {
      tenantId,
      action: AUDIT_ACTIONS.LOGIN,
      module: MODULES.AUTH,
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (userId) filter.userId = userId;

    const logs = await AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate({ path: 'userId', model: UserModel, select: 'name role branchId username employeeId' })
      .lean();

    // If branchId filter is applied, filter by populated user's branchId
    const filtered = branchId
      ? logs.filter((l: any) => l.userId?.branchId?.toString() === branchId)
      : logs;

    return {
      total: filtered.length,
      logs: filtered.map((l: any) => ({
        _id: l._id,
        name: l.actorName || (l.userId as any)?.name || '',
        username: l.actorUsername || (l.userId as any)?.username || '',
        role: (l.after as any)?.role || (l.userId as any)?.role || '',
        employeeId: (l.userId as any)?.employeeId || null,
        ipAddress: l.ip || null,
        loginAt: l.createdAt,
      })),
    };
  }
}
