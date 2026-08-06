import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import { NotFoundError } from '../../../domain/errors';

export default class GetExternalLedger {
  async execute({ tenantId, accountId, fromDate, toDate, limit = 200 }: any): Promise<any> {
    const account = await ExternalAccountModel.findOne({ _id: accountId, tenantId }).lean();
    if (!account) throw new NotFoundError('Partner account not found');

    const filter: any = { tenantId, externalAccountId: accountId };
    if (fromDate || toDate) {
      filter.entryDate = {};
      if (fromDate) filter.entryDate.$gte = fromDate;
      if (toDate)   filter.entryDate.$lte = toDate;
    }

    const entries = await ExternalLedgerModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return { account, entries };
  }
}
