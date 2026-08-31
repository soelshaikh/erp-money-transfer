import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { NotFoundError, ConflictError } from '../../../domain/errors';

export default class RejectPartnerTransfer {
  async execute(params: any): Promise<any> {
    const { tenantId, transferId, userId, userName, reason } = params;

    const transfer = await PartnerTransferModel.findOne({ _id: transferId, tenantId });
    if (!transfer) throw new NotFoundError('Partner transfer not found');
    if (transfer.status !== 'pending') throw new ConflictError(`Transfer cannot be rejected — current status: ${transfer.status}`);

    const fromBranchIdStr = transfer.fromBranchId.toString();

    await ExternalAccountModel.updateOne(
      { _id: transfer.externalAccountId, tenantId },
      { $inc: { [`onHolds.${fromBranchIdStr}`]: -transfer.amount } },
    );

    transfer.status = 'rejected';
    transfer.rejectedBy = userId;
    transfer.rejectedByName = userName || null;
    transfer.rejectionReason = reason?.trim() || null;
    transfer.rejectedAt = new Date();
    await transfer.save();

    return transfer;
  }
}
