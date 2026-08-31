import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../../domain/errors';
import { todayIST } from '../../../utils/dateIST';

export default class CompletePartnerTransfer {
  branchRepository: any;
  branchLedgerRepository: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
    this.branchLedgerRepository = deps.branchLedgerRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, transferId, userId, userName, userBranchId, role } = params;

    const transfer = await PartnerTransferModel.findOne({ _id: transferId, tenantId });
    if (!transfer) throw new NotFoundError('Partner transfer not found');
    if (transfer.status !== 'approved') throw new ConflictError(`Transfer cannot be completed — current status: ${transfer.status}`);

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

    const fromBalBefore = (partner.balances as any)?.get?.(fromBranchIdStr) ?? (partner.balances as any)?.[fromBranchIdStr] ?? 0;
    const toBalBefore = (partner.balances as any)?.get?.(toBranchIdStr) ?? (partner.balances as any)?.[toBranchIdStr] ?? 0;

    const finalAmount = (transfer as any).finalAmount ?? transfer.amount;
    const partnerCoversAmount = (transfer as any).partnerCoversAmount ?? transfer.amount;
    const branchCoversAmount = (transfer as any).branchCoversAmount ?? 0;
    const commissionSide = (transfer as any).commissionSide ?? 'none';
    const commissionAmount = (transfer as any).commissionAmount ?? 0;

    await Promise.all([
      ExternalLedgerModel.create({
        tenantId, externalAccountId: transfer.externalAccountId, branchId: transfer.fromBranchId,
        type: 'transfer_out', direction: 'debit', amount: transfer.amount,
        balanceBefore: fromBalBefore, balanceAfter: fromBalBefore - transfer.amount,
        description: `Transfer to ${toBranch?.name || toBranchIdStr} — ${transfer.transferRef}`,
        entryDate: today, createdBy: userId, createdByName: userName || null,
      }),
      ExternalLedgerModel.create({
        tenantId, externalAccountId: transfer.externalAccountId, branchId: transfer.toBranchId,
        type: 'transfer_in', direction: 'credit', amount: finalAmount,
        balanceBefore: toBalBefore, balanceAfter: toBalBefore + finalAmount,
        description: `Transfer from ${fromBranch?.name || fromBranchIdStr} — ${transfer.transferRef}`,
        entryDate: today, createdBy: userId, createdByName: userName || null,
      }),
      ExternalAccountModel.updateOne(
        { _id: partner._id, tenantId },
        {
          $inc: {
            [`balances.${fromBranchIdStr}`]: -transfer.amount,
            [`balances.${toBranchIdStr}`]: finalAmount,
            [`onHolds.${fromBranchIdStr}`]: -partnerCoversAmount,
          },
        },
      ),
    ]);

    // Branch covered the shortfall: debit branch balance, clear committed amount
    if (branchCoversAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, transfer.fromBranchId, {
        transactionId: null, type: 'debit', amount: branchCoversAmount,
        description: `Partner transfer branch coverage — ${transfer.transferRef}`,
        event: 'payout_completed', tokenNumber: null, committedPayoutAmount: branchCoversAmount,
      });
    }

    // Commission at completion
    if (commissionAmount > 0) {
      if (commissionSide === 'payout') {
        // Receiver pays: FROM branch (AHM) keeps the difference
        await this.branchLedgerRepository.addEntry(tenantId, transfer.fromBranchId, {
          transactionId: null, type: 'credit', amount: commissionAmount,
          description: `Partner transfer commission — ${transfer.transferRef}`,
          event: 'partner_commission', tokenNumber: null,
        });
      } else if (commissionSide === 'payout_extra') {
        // Receiver extra: TO branch (MUM) earns commission from Lenar
        await this.branchLedgerRepository.addEntry(tenantId, transfer.toBranchId, {
          transactionId: null, type: 'credit', amount: commissionAmount,
          description: `Partner transfer commission — ${transfer.transferRef}`,
          event: 'partner_commission', tokenNumber: null,
        });
      }
    }

    transfer.status = 'completed';
    transfer.completedBy = userId;
    transfer.completedByName = userName || null;
    transfer.completedAt = new Date();
    await transfer.save();

    return transfer;
  }
}
