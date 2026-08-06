import AppInstallModel from '../../../infrastructure/db/models/AppInstall.model';

export default class ListAppAccess {
  async execute({ status }: any): Promise<any[]> {
    const filter: any = {};
    if (status) filter.status = status;
    const records = await AppInstallModel.find(filter).sort({ createdAt: -1 }).lean();
    return records;
  }
}
