export default class ExternalAccountController {
  private createExternalAccount: any;
  private getExternalAccounts: any;
  private updateExternalAccount: any;
  private addExternalEntry: any;
  private getExternalLedger: any;

  constructor(deps: any) {
    this.createExternalAccount = deps.createExternalAccount;
    this.getExternalAccounts   = deps.getExternalAccounts;
    this.updateExternalAccount = deps.updateExternalAccount;
    this.addExternalEntry      = deps.addExternalEntry;
    this.getExternalLedger     = deps.getExternalLedger;

    this.create      = this.create.bind(this);
    this.list        = this.list.bind(this);
    this.update      = this.update.bind(this);
    this.addEntry    = this.addEntry.bind(this);
    this.getLedger   = this.getLedger.bind(this);
  }

  async create(req: any, res: any) {
    const { tenantId, id: createdBy, name: actorName } = req.user;
    const result = await this.createExternalAccount.execute({ tenantId, createdBy, ...req.body });
    res.status(201).json({ success: true, data: result });
  }

  async list(req: any, res: any) {
    const { tenantId } = req.user;
    const { status } = req.query;
    const result = await this.getExternalAccounts.execute({ tenantId, status });
    res.status(200).json({ success: true, data: result });
  }

  async update(req: any, res: any) {
    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await this.updateExternalAccount.execute({ tenantId, accountId: id, updates: req.body });
    res.status(200).json({ success: true, data: result });
  }

  async addEntry(req: any, res: any) {
    const { tenantId, id: createdBy, name: createdByName } = req.user;
    const { id: accountId } = req.params;
    const { type, direction, amount, description, entryDate } = req.body;
    const result = await this.addExternalEntry.execute({
      tenantId, accountId, type, direction,
      amount: Math.round(amount),
      description, entryDate, createdBy, createdByName,
    });
    res.status(201).json({ success: true, data: result });
  }

  async getLedger(req: any, res: any) {
    const { tenantId } = req.user;
    const { id: accountId } = req.params;
    const { fromDate, toDate, limit } = req.query;
    const result = await this.getExternalLedger.execute({ tenantId, accountId, fromDate, toDate, limit: limit ? parseInt(limit) : 200 });
    res.status(200).json({ success: true, data: result });
  }
}
