export default class AuditLogController {
  private getAuditLogs: any;

  constructor({ getAuditLogs }: any) {
    this.getAuditLogs = getAuditLogs;
    this.list = this.list.bind(this);
  }

  async list(req: any, res: any) {
    const { module, action, userId, dateFrom, dateTo, page, limit } = req.query;
    const result = await this.getAuditLogs.execute({
      tenantId: req.user.tenantId,
      module,
      action,
      userId,
      dateFrom,
      dateTo,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.json({ success: true, data: result });
  }
}
