import RegisterAppInstall from '../../../application/use-cases/appInstall/RegisterAppInstall';
import RequestAppAccess from '../../../application/use-cases/appInstall/RequestAppAccess';
import ApproveAppAccess from '../../../application/use-cases/appInstall/ApproveAppAccess';
import RejectAppAccess from '../../../application/use-cases/appInstall/RejectAppAccess';
import ListAppAccess from '../../../application/use-cases/appInstall/ListAppAccess';

export default class AppInstallController {
  private registerAppInstall: RegisterAppInstall;
  private requestAppAccess: RequestAppAccess;
  private approveAppAccess: ApproveAppAccess;
  private rejectAppAccess: RejectAppAccess;
  private listAppAccess: ListAppAccess;

  constructor(deps: any) {
    this.registerAppInstall = deps.registerAppInstall;
    this.requestAppAccess   = deps.requestAppAccess;
    this.approveAppAccess   = deps.approveAppAccess;
    this.rejectAppAccess    = deps.rejectAppAccess;
    this.listAppAccess      = deps.listAppAccess;

    this.register       = this.register.bind(this);
    this.requestAccess  = this.requestAccess.bind(this);
    this.approve        = this.approve.bind(this);
    this.reject         = this.reject.bind(this);
    this.list           = this.list.bind(this);
  }

  async register(req: any, res: any) {
    const { deviceId, deviceName, platform, appVersion } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await this.registerAppInstall.execute({ deviceId, deviceName, platform, appVersion, ip, userAgent });
    res.status(200).json({ success: true, data: result });
  }

  async requestAccess(req: any, res: any) {
    const { secretCode, deviceId, deviceName, platform } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await this.requestAppAccess.execute({ secretCode, deviceId, deviceName, platform, ip, userAgent });
    res.status(200).json({ success: true, data: result });
  }

  async approve(req: any, res: any) {
    const { deviceId } = req.params;
    const result = await this.approveAppAccess.execute({ deviceId });
    res.status(200).json({ success: true, data: result });
  }

  async reject(req: any, res: any) {
    const { deviceId } = req.params;
    const result = await this.rejectAppAccess.execute({ deviceId });
    res.status(200).json({ success: true, data: result });
  }

  async list(req: any, res: any) {
    const { status } = req.query;
    const result = await this.listAppAccess.execute({ status });
    res.status(200).json({ success: true, data: result });
  }
}
