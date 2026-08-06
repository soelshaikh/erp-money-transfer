import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';

export default class GetExternalAccounts {
  async execute({ tenantId, status }: any): Promise<any[]> {
    const filter: any = { tenantId };
    if (status) filter.status = status;
    return ExternalAccountModel.find(filter).sort({ name: 1 }).lean();
  }
}
