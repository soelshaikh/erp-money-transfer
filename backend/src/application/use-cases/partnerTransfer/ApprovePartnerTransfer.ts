import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../../domain/errors';

export default class ApprovePartnerTransfer {
  async execute(params: any): Promise<any> {
    const { tenantId, transferId, userId, userName } = params;

    const transfer = await PartnerTransferModel.findOne({ _id: transferId, tenantId });
    if (!transfer) throw new NotFoundError('Partner transfer not found');
    if (transfer.status !== 'pending') throw new ConflictError(`Transfer is already ${transfer.status}`);
    if (transfer.createdByRole === 'head_office') throw new BusinessRuleError('HO-created transfers are completed immediately and cannot be approved separately');

    transfer.status = 'approved';
    transfer.approvedBy = userId;
    transfer.approvedByName = userName || null;
    transfer.approvedAt = new Date();
    await transfer.save();

    return transfer;
  }
}
