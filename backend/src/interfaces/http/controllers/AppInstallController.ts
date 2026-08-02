import RegisterAppInstall from '../../../application/use-cases/appInstall/RegisterAppInstall';

export default class AppInstallController {
  private registerAppInstall: RegisterAppInstall;

  constructor({ registerAppInstall }: any) {
    this.registerAppInstall = registerAppInstall;
    this.register = this.register.bind(this);
  }

  async register(req: any, res: any) {
    const { deviceId, deviceName, platform, appVersion } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await this.registerAppInstall.execute({ deviceId, deviceName, platform, appVersion, ip, userAgent });
    res.status(200).json({ success: true, data: result });
  }
}
