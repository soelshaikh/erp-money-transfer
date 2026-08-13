import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import { NotFoundError } from '../../../domain/errors';

export default class UpdateExternalAccount {
  async execute({ tenantId, accountId, updates }: any): Promise<any> {
    const account = await ExternalAccountModel.findOne({ _id: accountId, tenantId });
    if (!account) throw new NotFoundError('Partner account not found');

    const allowed = ['name', 'contactPerson', 'phone', 'address', 'notes', 'status', 'branchId'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        (account as any)[key] = typeof updates[key] === 'string' ? updates[key].trim() : updates[key];
      }
    }

    await account.save();
    return account;
  }
}
