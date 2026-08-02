import AppInstallModel from '../../../infrastructure/db/models/AppInstall.model';

export default class RegisterAppInstall {
  async execute({ deviceId, deviceName, platform, appVersion, ip, userAgent }: any): Promise<any> {
    if (!deviceId) return { recorded: false };
    await AppInstallModel.findOneAndUpdate(
      { deviceId },
      { $setOnInsert: { deviceId, deviceName, platform, appVersion, ip, userAgent } },
      { upsert: true, new: false }
    );
    return { recorded: true };
  }
}
