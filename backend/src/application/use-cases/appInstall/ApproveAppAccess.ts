import AppInstallModel from '../../../infrastructure/db/models/AppInstall.model';
import { APP_ACCESS_STATUS } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class ApproveAppAccess {
  async execute({ deviceId }: any): Promise<{ status: string }> {
    const record = await AppInstallModel.findOne({ deviceId });
    if (!record) throw new NotFoundError('Device access request not found');

    record.status = APP_ACCESS_STATUS.APPROVED;
    record.approvedAt = new Date();
    record.rejectedAt = null;
    await record.save();

    return { status: APP_ACCESS_STATUS.APPROVED };
  }
}
