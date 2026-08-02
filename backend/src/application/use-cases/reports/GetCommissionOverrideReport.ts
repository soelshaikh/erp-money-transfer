import AuditLogModel from '../../../infrastructure/db/models/AuditLog.model';

export default class GetCommissionOverrideReport {
  constructor(_deps: any = {}) {}

  async execute({ tenantId, fromDate, toDate, branchId, page = 1, limit = 20 }: any) {
    const p = Number(page);
    const l = Number(limit);

    const query: any = {
      tenantId,
      action: 'COMMISSION_OVERRIDE',
      module: 'Transaction',
    };

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (branchId) {
      // Filter by branchId stored in the after object (best-effort)
      query['after.branchId'] = branchId;
    }

    const skip = (p - 1) * l;

    const [docs, total] = await Promise.all([
      AuditLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l)
        .lean(),
      AuditLogModel.countDocuments(query),
    ]);

    const data = docs.map((doc: any) => ({
      _id: doc._id,
      actorName: doc.actorName,
      actorUsername: doc.actorUsername,
      entityId: doc.entityId,
      after: doc.after || {},
      createdAt: doc.createdAt,
    }));

    return { data, total, page: p, limit: l };
  }
}
