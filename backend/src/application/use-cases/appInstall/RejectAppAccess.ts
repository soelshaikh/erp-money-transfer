import AppInstallModel from '../../../infrastructure/db/models/AppInstall.model';
import { APP_ACCESS_STATUS } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class RejectAppAccess {
  async execute({ deviceId }: any): Promise<{ status: string }> {
    const record = await AppInstallModel.findOne({ deviceId });
    if (!record) throw new NotFoundError('Device access request not found');

    record.status = APP_ACCESS_STATUS.REJECTED;
    record.rejectedAt = new Date();
    record.approvedAt = null;
    await record.save();

    return { status: APP_ACCESS_STATUS.REJECTED };
  }
}
