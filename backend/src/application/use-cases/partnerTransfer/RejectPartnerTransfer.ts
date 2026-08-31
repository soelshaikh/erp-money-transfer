import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { NotFoundError, ConflictError } from '../../../domain/errors';

export default class RejectPartnerTransfer {
  branchLedgerRepository: any;

  constructor(deps: any) {
    this.branchLedgerRepository = deps.branchLedgerRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, transferId, userId, userName, reason } = params;

    const transfer = await PartnerTransferModel.findOne({ _id: transferId, tenantId });
    if (!transfer) throw new NotFoundError('Partner transfer not found');
    if (transfer.status !== 'pending') throw new ConflictError(`Transfer cannot be rejected — current status: ${transfer.status}`);

    const fromBranchIdStr = transfer.fromBranchId.toString();
    const partnerCoversAmount = (transfer as any).partnerCoversAmount ?? transfer.amount;
    const branchCoversAmount = (transfer as any).branchCoversAmount ?? 0;
    const commissionSide = (transfer as any).commissionSide ?? 'none';
    const commissionAmount = (transfer as any).commissionAmount ?? 0;

    if (partnerCoversAmount > 0) {
      await ExternalAccountModel.updateOne(
        { _id: transfer.externalAccountId, tenantId },
        { $inc: { [`onHolds.${fromBranchIdStr}`]: -partnerCoversAmount } },
      );
    }

    if (branchCoversAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, transfer.fromBranchId, {
        transactionId: null, type: 'pending_reversed', amount: branchCoversAmount,
        description: `Partner transfer rejected — ${transfer.transferRef}`,
        event: 'payout_committed_reversed', tokenNumber: null,
      });
    }

    if (commissionSide === 'collection' && commissionAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, transfer.fromBranchId, {
        transactionId: null, type: 'debit', amount: commissionAmount,
        description: `Partner transfer commission reversal — ${transfer.transferRef}`,
        event: 'partner_commission_reversal', tokenNumber: null,
      });
    }

    transfer.status = 'rejected';
    transfer.rejectedBy = userId;
    transfer.rejectedByName = userName || null;
    transfer.rejectionReason = reason?.trim() || null;
    transfer.rejectedAt = new Date();
    await transfer.save();

    return transfer;
  }
}
