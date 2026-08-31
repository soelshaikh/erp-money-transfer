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
    if (!['deposit', 'due', 'adjustment', 'withdrawal'].includes(type)) throw new ValidationError('Invalid entry type');
    if (type === 'withdrawal' && direction !== 'debit') throw new ValidationError('Withdrawal must be a debit');
    if (!['credit', 'debit'].includes(direction)) throw new ValidationError('Invalid direction');

    const account = await ExternalAccountModel.findOne({ _id: accountId, tenantId });
    if (!account) throw new NotFoundError('Partner account not found');
    if (account.status !== 'active') throw new ValidationError('Cannot add entry to an inactive partner account');

    const totalBalanceBefore = account.balance;
    const increment = direction === 'credit' ? amount : -amount;
    const totalBalanceAfter = totalBalanceBefore + increment;

    const effectiveBranchId = branchId || null;
    // Per-branch balance before (for ledger display)
    const branchBalanceBefore = effectiveBranchId
      ? ((account.balances as any)?.get?.(effectiveBranchId.toString()) ?? (account.balances as any)?.[effectiveBranchId.toString()] ?? 0)
      : totalBalanceBefore;

    const date = entryDate || toISTDate(new Date());

    const balanceUpdate: any = { $inc: { balance: increment } };
    if (effectiveBranchId) balanceUpdate.$inc[`balances.${effectiveBranchId}`] = increment;

    const [entry] = await Promise.all([
      ExternalLedgerModel.create({
        tenantId,
        externalAccountId: accountId,
        transactionId: transactionId || null,
        branchId: effectiveBranchId,
        type,
        direction,
        amount,
        balanceBefore: branchBalanceBefore,
        balanceAfter: branchBalanceBefore + increment,
        description: description?.trim() || null,
        entryDate: date,
        createdBy,
        createdByName: createdByName || null,
      }),
      ExternalAccountModel.updateOne({ _id: accountId, tenantId }, balanceUpdate),
    ]);

    // Sync branch balance + create branch ledger trail for manual entries with a branch
    let branchUpdated = false;
    let branchSkipReason = '';

    if (!transactionId && effectiveBranchId && this.branchLedgerRepository) {
      const branchEvent = direction === 'credit' ? 'partner_deposit' : (type === 'withdrawal' ? 'partner_withdrawal' : 'partner_due');
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

    return { entry, balanceAfter: totalBalanceAfter, branchUpdated, branchSkipReason };
  }
}
