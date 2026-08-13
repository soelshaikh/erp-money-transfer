import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';

export default class GetExternalAccounts {
  async execute({ tenantId, status, branchId }: any): Promise<any[]> {
    const filter: any = { tenantId };
    if (status) filter.status = status;
    if (branchId) filter.branchId = branchId;
    return ExternalAccountModel.find(filter).populate('branchId', 'name code').sort({ name: 1 }).lean();
  }
}
