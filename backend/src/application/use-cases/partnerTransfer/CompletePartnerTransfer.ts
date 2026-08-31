import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../../domain/errors';
import { todayIST } from '../../../utils/dateIST';

export default class CompletePartnerTransfer {
  branchRepository: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, transferId, userId, userName, userBranchId, role } = params;

    const transfer = await PartnerTransferModel.findOne({ _id: transferId, tenantId });
    if (!transfer) throw new NotFoundError('Partner transfer not found');
    if (transfer.status !== 'approved') throw new ConflictError(`Transfer cannot be completed — current status: ${transfer.status}`);

    // Only destination branch or HO can complete
    if (role === 'branch' && userBranchId && transfer.toBranchId.toString() !== userBranchId.toString()) {
      throw new BusinessRuleError('Only the destination branch can complete this transfer');
    }

    const partner = await ExternalAccountModel.findOne({ _id: transfer.externalAccountId, tenantId });
    if (!partner) throw new NotFoundError('Partner account not found');

    const fromBranchIdStr = transfer.fromBranchId.toString();
    const toBranchIdStr = transfer.toBranchId.toString();
    const today = todayIST();

    const [fromBranch, toBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, fromBranchIdStr),
      this.branchRepository.findById(tenantId, toBranchIdStr),
    ]);

    // Branch-specific balances before
    const fromBalBefore = (partner.balances as any)?.get?.(fromBranchIdStr) ?? (partner.balances as any)?.[fromBranchIdStr] ?? 0;
    const toBalBefore = (partner.balances as any)?.get?.(toBranchIdStr) ?? (partner.balances as any)?.[toBranchIdStr] ?? 0;

    // Atomic: move balances, release onHold, create 2 ledger entries, mark completed
    await Promise.all([
      ExternalLedgerModel.create({
        tenantId,
        externalAccountId: transfer.externalAccountId,
        branchId: transfer.fromBranchId,
        type: 'transfer_out',
        direction: 'debit',
        amount: transfer.amount,
        balanceBefore: fromBalBefore,
        balanceAfter: fromBalBefore - transfer.amount,
        description: `Transfer to ${toBranch?.name || toBranchIdStr} — ${transfer.transferRef}`,
        entryDate: today,
        createdBy: userId,
        createdByName: userName || null,
      }),
      ExternalLedgerModel.create({
        tenantId,
        externalAccountId: transfer.externalAccountId,
        branchId: transfer.toBranchId,
        type: 'transfer_in',
        direction: 'credit',
        amount: transfer.amount,
        balanceBefore: toBalBefore,
        balanceAfter: toBalBefore + transfer.amount,
        description: `Transfer from ${fromBranch?.name || fromBranchIdStr} — ${transfer.transferRef}`,
        entryDate: today,
        createdBy: userId,
        createdByName: userName || null,
      }),
      ExternalAccountModel.updateOne(
        { _id: partner._id, tenantId },
        {
          $inc: {
            [`balances.${fromBranchIdStr}`]: -transfer.amount,
            [`balances.${toBranchIdStr}`]: transfer.amount,
            [`onHolds.${fromBranchIdStr}`]: -transfer.amount,
          },
        },
      ),
    ]);

    transfer.status = 'completed';
    transfer.completedBy = userId;
    transfer.completedByName = userName || null;
    transfer.completedAt = new Date();
    await transfer.save();

    return transfer;
  }
}
