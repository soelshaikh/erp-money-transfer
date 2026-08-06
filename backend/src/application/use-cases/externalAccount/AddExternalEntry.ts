import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import { NotFoundError, ValidationError } from '../../../domain/errors';
import { toISTDate } from '../../../utils/dateIST';

export default class AddExternalEntry {
  async execute(params: any): Promise<any> {
    const { tenantId, accountId, type, direction, amount, description, entryDate, createdBy, createdByName } = params;

    if (!amount || amount <= 0) throw new ValidationError('Amount must be greater than zero');
    if (!['deposit', 'due', 'adjustment'].includes(type)) throw new ValidationError('Invalid entry type');
    if (!['credit', 'debit'].includes(direction)) throw new ValidationError('Invalid direction');

    const account = await ExternalAccountModel.findOne({ _id: accountId, tenantId });
    if (!account) throw new NotFoundError('Partner account not found');
    if (account.status !== 'active') throw new ValidationError('Cannot add entry to an inactive partner account');

    const balanceBefore = account.balance;
    // credit (deposit) → balance increases; debit (due) → balance decreases
    const balanceAfter = direction === 'credit' ? balanceBefore + amount : balanceBefore - amount;

    const date = entryDate || toISTDate(new Date());

    const [entry] = await Promise.all([
      ExternalLedgerModel.create({
        tenantId,
        externalAccountId: accountId,
        type,
        direction,
        amount,
        balanceBefore,
        balanceAfter,
        description: description?.trim() || null,
        entryDate: date,
        createdBy,
        createdByName: createdByName || null,
      }),
      ExternalAccountModel.updateOne({ _id: accountId, tenantId }, { $set: { balance: balanceAfter } }),
    ]);

    return { entry, balanceAfter };
  }
}
