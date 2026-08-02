export default class SettingsController {
  private getSettings: any;
  private updateSettings: any;

  constructor({ getSettings, updateSettings }: any) {
    this.getSettings = getSettings;
    this.updateSettings = updateSettings;
    this.get = this.get.bind(this);
    this.update = this.update.bind(this);
  }

  async get(req: any, res: any) {
    const result = await this.getSettings.execute({ tenantId: req.user.tenantId });
    res.json({ success: true, data: result });
  }

  async update(req: any, res: any) {
    const result = await this.updateSettings.execute({ tenantId: req.user.tenantId, ...req.body, userId: req.user.id });
    res.json({ success: true, data: result });
  }
}
