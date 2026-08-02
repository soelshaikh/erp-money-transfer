export default class DashboardController {
  private getDashboard: any;

  constructor({ getDashboard }: any) {
    this.getDashboard = getDashboard;
    this.get = this.get.bind(this);
  }

  async get(req: any, res: any) {
    const { fromDate, toDate } = req.query;

    const result = await this.getDashboard.execute({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      role: req.user.role,
      branchId: req.user.branchId,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
    res.json({ success: true, data: result });
  }
}
