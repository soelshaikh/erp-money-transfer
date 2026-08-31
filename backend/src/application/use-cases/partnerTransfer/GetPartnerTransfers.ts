import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';

export default class GetPartnerTransfers {
  async execute(params: any): Promise<any> {
    const { tenantId, externalAccountId, fromBranchId, toBranchId, status, branchId, role, limit = 100, page = 1 } = params;

    const filter: any = { tenantId };
    if (externalAccountId) filter.externalAccountId = externalAccountId;
    if (status) filter.status = status;

    if (role === 'branch' && branchId) {
      // Branch sees transfers where they are the source or destination
      filter.$or = [{ fromBranchId: branchId }, { toBranchId: branchId }];
    } else {
      if (fromBranchId) filter.fromBranchId = fromBranchId;
      if (toBranchId) filter.toBranchId = toBranchId;
    }

    const skip = (page - 1) * limit;
    const [transfers, total] = await Promise.all([
      PartnerTransferModel.find(filter)
        .populate('externalAccountId', 'name code')
        .populate('fromBranchId', 'name code')
        .populate('toBranchId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerTransferModel.countDocuments(filter),
    ]);

    return { transfers, total, page, limit };
  }
}
