import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import { NotFoundError, ValidationError } from '../../../domain/errors';
import { toISTDate } from '../../../utils/dateIST';

export default class AddExternalEntry {
  branchLedgerRepository: any;

  constructor(deps: any = {}) {
    this.branchLedgerRepository = deps.branchLedgerRepository || null;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, accountId, type, direction, amount, description, entryDate, createdBy, createdByName, branchId, transactionId } = params;

    if (!amount || amount <= 0) throw new ValidationError('Amount must be greater than zero');
    if (!['deposit', 'due', 'adjustment'].includes(type)) throw new ValidationError('Invalid entry type');
    if (!['credit', 'debit'].includes(direction)) throw new ValidationError('Invalid direction');

    const account = await ExternalAccountModel.findOne({ _id: accountId, tenantId });
    if (!account) throw new NotFoundError('Partner account not found');
    if (account.status !== 'active') throw new ValidationError('Cannot add entry to an inactive partner account');

    const balanceBefore = account.balance;
    const balanceAfter = direction === 'credit' ? balanceBefore + amount : balanceBefore - amount;

    const date = entryDate || toISTDate(new Date());
    const effectiveBranchId = branchId || null;

    const [entry] = await Promise.all([
      ExternalLedgerModel.create({
        tenantId,
        externalAccountId: accountId,
        transactionId: transactionId || null,
        branchId: effectiveBranchId,
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

    // Sync branch balance + create branch ledger trail for manual entries with a branch
    let branchUpdated = false;
    let branchSkipReason = '';

    if (!transactionId && effectiveBranchId && this.branchLedgerRepository) {
      const branchEvent = direction === 'credit' ? 'partner_deposit' : 'partner_due';
      console.log(`[AddExternalEntry] updating branch ${effectiveBranchId} with ${branchEvent} amount=${amount}`);
      try {
        await this.branchLedgerRepository.addEntry(tenantId, effectiveBranchId, {
          transactionId: null,
          type: direction === 'credit' ? 'credit' : 'debit',
          amount,
          description: description?.trim() || `Partner ${type}`,
          event: branchEvent,
          tokenNumber: null,
        });
        branchUpdated = true;
        console.log(`[AddExternalEntry] branch balance updated OK`);
      } catch (err: any) {
        branchSkipReason = err?.message || 'unknown error';
        console.error(`[AddExternalEntry] branch balance update FAILED:`, branchSkipReason);
        throw err;
      }
    } else {
      branchSkipReason = `transactionId=${transactionId} branchId=${effectiveBranchId} hasRepo=${!!this.branchLedgerRepository}`;
      console.log(`[AddExternalEntry] skipping branch update — ${branchSkipReason}`);
    }

    return { entry, balanceAfter, branchUpdated, branchSkipReason };
  }
}
