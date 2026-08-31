import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../../domain/errors';

export default class CancelPartnerTransfer {
  async execute(params: any): Promise<any> {
    const { tenantId, transferId, userId, userName, userBranchId, role, reason } = params;

    const transfer = await PartnerTransferModel.findOne({ _id: transferId, tenantId });
    if (!transfer) throw new NotFoundError('Partner transfer not found');

    if (!['pending', 'approved'].includes(transfer.status)) {
      throw new ConflictError(`Transfer cannot be cancelled — current status: ${transfer.status}`);
    }

    // Branch can only cancel their own pending transfers
    if (role === 'branch') {
      if (transfer.status !== 'pending') throw new BusinessRuleError('Branch can only cancel pending transfers. Contact head office to cancel approved transfers.');
      if (transfer.createdBy.toString() !== userId.toString() && transfer.fromBranchId.toString() !== userBranchId?.toString()) {
        throw new BusinessRuleError('You can only cancel your own branch transfers');
      }
    }

    const fromBranchIdStr = transfer.fromBranchId.toString();

    // Release onHold (applies to both pending and approved states since balance hasn't moved yet)
    await ExternalAccountModel.updateOne(
      { _id: transfer.externalAccountId, tenantId },
      { $inc: { [`onHolds.${fromBranchIdStr}`]: -transfer.amount } },
    );

    transfer.status = 'cancelled';
    transfer.cancelledBy = userId;
    transfer.cancelledByName = userName || null;
    transfer.cancellationReason = reason?.trim() || null;
    transfer.cancelledAt = new Date();
    await transfer.save();

    return transfer;
  }
}
