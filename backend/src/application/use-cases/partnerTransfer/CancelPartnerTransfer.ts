import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../../domain/errors';

export default class CancelPartnerTransfer {
  branchLedgerRepository: any;

  constructor(deps: any) {
    this.branchLedgerRepository = deps.branchLedgerRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, transferId, userId, userName, userBranchId, role, reason } = params;

    const transfer = await PartnerTransferModel.findOne({ _id: transferId, tenantId });
    if (!transfer) throw new NotFoundError('Partner transfer not found');

    if (!['pending', 'approved'].includes(transfer.status)) {
      throw new ConflictError(`Transfer cannot be cancelled — current status: ${transfer.status}`);
    }

    if (role === 'branch') {
      if (transfer.status !== 'pending') throw new BusinessRuleError('Branch can only cancel pending transfers. Contact head office to cancel approved transfers.');
      if (transfer.createdBy.toString() !== userId.toString() && transfer.fromBranchId.toString() !== userBranchId?.toString()) {
        throw new BusinessRuleError('You can only cancel your own branch transfers');
      }
    }

    const fromBranchIdStr = transfer.fromBranchId.toString();
    const partnerCoversAmount = (transfer as any).partnerCoversAmount ?? transfer.amount;
    const branchCoversAmount = (transfer as any).branchCoversAmount ?? 0;
    const commissionSide = (transfer as any).commissionSide ?? 'none';
    const commissionAmount = (transfer as any).commissionAmount ?? 0;

    // Release partner onHold only for what partner was covering
    if (partnerCoversAmount > 0) {
      await ExternalAccountModel.updateOne(
        { _id: transfer.externalAccountId, tenantId },
        { $inc: { [`onHolds.${fromBranchIdStr}`]: -partnerCoversAmount } },
      );
    }

    // Release branch committed payout if branch was covering shortfall
    if (branchCoversAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, transfer.fromBranchId, {
        transactionId: null, type: 'pending_reversed', amount: branchCoversAmount,
        description: `Partner transfer cancelled — ${transfer.transferRef}`,
        event: 'payout_committed_reversed', tokenNumber: null,
      });
    }

    // Reverse sender-pays commission credited at create time
    if (commissionSide === 'collection' && commissionAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, transfer.fromBranchId, {
        transactionId: null, type: 'debit', amount: commissionAmount,
        description: `Partner transfer commission reversal — ${transfer.transferRef}`,
        event: 'partner_commission_reversal', tokenNumber: null,
      });
    }

    transfer.status = 'cancelled';
    transfer.cancelledBy = userId;
    transfer.cancelledByName = userName || null;
    transfer.cancellationReason = reason?.trim() || null;
    transfer.cancelledAt = new Date();
    await transfer.save();

    return transfer;
  }
}
