export default class ReportController {
  private getReportsUseCase: any;
  private exportReportUseCase: any;
  private getLoginReportUseCase: any;
  private getDailyReportUseCase: any;
  private getPendingQueueUseCase: any;
  private getOutstandingPaymentsUseCase: any;
  private getRejectedTransactionsUseCase: any;
  private getBranchCollectionReportUseCase: any;
  private getBranchFlowMatrixUseCase: any;
  private getDailyTallyUseCase: any;
  private getAllBranchDailyBalancesUseCase: any;
  private getCashPositionUseCase: any;
  private getStaffReportUseCase: any;
  private getCommissionOverrideReportUseCase: any;
  private getPeriodComparisonUseCase: any;
  private getPaymentMethodReportUseCase: any;

  constructor({
    getReports,
    exportReport,
    getLoginReport,
    getDailyReport,
    getPendingQueue,
    getOutstandingPayments,
    getRejectedTransactions,
    getBranchCollectionReport,
    getBranchFlowMatrix,
    getDailyTally,
    getAllBranchDailyBalances,
    getCashPosition,
    getStaffReport,
    getCommissionOverrideReport,
    getPeriodComparison,
    getPaymentMethodReport,
  }: any) {
    this.getReportsUseCase = getReports;
    this.exportReportUseCase = exportReport;
    this.getLoginReportUseCase = getLoginReport;
    this.getDailyReportUseCase = getDailyReport;
    this.getPendingQueueUseCase = getPendingQueue;
    this.getOutstandingPaymentsUseCase = getOutstandingPayments;
    this.getRejectedTransactionsUseCase = getRejectedTransactions;
    this.getBranchCollectionReportUseCase = getBranchCollectionReport;
    this.getBranchFlowMatrixUseCase = getBranchFlowMatrix;
    this.getDailyTallyUseCase = getDailyTally;
    this.getAllBranchDailyBalancesUseCase = getAllBranchDailyBalances;
    this.getCashPositionUseCase = getCashPosition;
    this.getStaffReportUseCase = getStaffReport;
    this.getCommissionOverrideReportUseCase = getCommissionOverrideReport;
    this.getPeriodComparisonUseCase = getPeriodComparison;
    this.getPaymentMethodReportUseCase = getPaymentMethodReport;

    this.getReports = this.getReports.bind(this);
    this.exportReports = this.exportReports.bind(this);
    this.loginReport = this.loginReport.bind(this);
    this.dailyReport = this.dailyReport.bind(this);
    this.pendingQueue = this.pendingQueue.bind(this);
    this.outstandingPayments = this.outstandingPayments.bind(this);
    this.rejectedTransactions = this.rejectedTransactions.bind(this);
    this.branchCollectionReport = this.branchCollectionReport.bind(this);
    this.branchFlowMatrix = this.branchFlowMatrix.bind(this);
    this.dailyTally = this.dailyTally.bind(this);
    this.allBranchBalances = this.allBranchBalances.bind(this);
    this.cashPosition = this.cashPosition.bind(this);
    this.staffReport = this.staffReport.bind(this);
    this.commissionOverrides = this.commissionOverrides.bind(this);
    this.periodComparison = this.periodComparison.bind(this);
    this.paymentMethodReport = this.paymentMethodReport.bind(this);
  }

  async getReports(req: any, res: any): Promise<void> {
    const { tenantId, id: userId, role, branchId } = req.user;
    const { startDate, endDate, type = 'daily' } = req.query;
    const result = await this.getReportsUseCase.execute({ tenantId, branchId, role, startDate, endDate, type });
    res.json({ success: true, data: result });
  }

  async exportReports(req: any, res: any): Promise<void> {
    const { tenantId, branchId, role } = req.user;
    const { startDate, endDate, format = 'excel', reportType } = req.query;
    const { buffer, contentType, filename } = await this.exportReportUseCase.execute({
      tenantId,
      branchId,
      role,
      startDate,
      endDate,
      format,
      reportType,
    });
    // Return base64-encoded file so React Native can write it without arraybuffer issues
    res.json({
      success: true,
      data: {
        base64: (buffer as Buffer).toString('base64'),
        contentType,
        filename,
      },
    });
  }

  async loginReport(req: any, res: any, next: any): Promise<void> {
    try {
      const { startDate, endDate, userId, branchId } = req.query;
      const result = await this.getLoginReportUseCase.execute({
        tenantId: req.user.tenantId,
        role: req.user.role,
        branchId: req.user.role === 'branch' ? req.user.branchId : branchId,
        startDate,
        endDate,
        userId,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async dailyReport(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId, role, branchId } = req.user;
      const { fromDate, toDate } = req.query;
      const result = await this.getDailyReportUseCase.execute({ tenantId, role, branchId, fromDate, toDate });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async pendingQueue(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId, role, branchId } = req.user;
      const { page, limit } = req.query;
      const result = await this.getPendingQueueUseCase.execute({ tenantId, role, branchId, page, limit });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async outstandingPayments(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId, role, branchId } = req.user;
      const { page, limit } = req.query;
      const result = await this.getOutstandingPaymentsUseCase.execute({ tenantId, role, branchId, page, limit });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async rejectedTransactions(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId, role, branchId } = req.user;
      const { fromDate, toDate, page, limit } = req.query;
      const result = await this.getRejectedTransactionsUseCase.execute({ tenantId, role, branchId, fromDate, toDate, page, limit });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async branchCollectionReport(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId } = req.user;
      const { fromDate, toDate } = req.query;
      const result = await this.getBranchCollectionReportUseCase.execute({ tenantId, fromDate, toDate });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async branchFlowMatrix(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId } = req.user;
      const { fromDate, toDate, approvalStatus, paymentStatus } = req.query;
      const result = await this.getBranchFlowMatrixUseCase.execute({ tenantId, fromDate, toDate, approvalStatus, paymentStatus });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async dailyTally(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId } = req.user;
      const { date } = req.query;
      const result = await this.getDailyTallyUseCase.execute({ tenantId, date });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async allBranchBalances(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId } = req.user;
      const { fromDate, toDate } = req.query;
      const result = await this.getAllBranchDailyBalancesUseCase.execute({ tenantId, fromDate, toDate });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async cashPosition(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId } = req.user;
      const result = await this.getCashPositionUseCase.execute({ tenantId });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async staffReport(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId, role, branchId } = req.user;
      const { fromDate, toDate } = req.query;
      const result = await this.getStaffReportUseCase.execute({ tenantId, role, branchId, fromDate, toDate });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async commissionOverrides(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId } = req.user;
      const { fromDate, toDate, branchId, page, limit } = req.query;
      const result = await this.getCommissionOverrideReportUseCase.execute({ tenantId, fromDate, toDate, branchId, page, limit });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async periodComparison(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId, role, branchId } = req.user;
      const { period } = req.query;
      const result = await this.getPeriodComparisonUseCase.execute({ tenantId, role, branchId, period });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async paymentMethodReport(req: any, res: any, next: any): Promise<void> {
    try {
      const { tenantId, role, branchId } = req.user;
      const { fromDate, toDate } = req.query;
      const result = await this.getPaymentMethodReportUseCase.execute({ tenantId, role, branchId, fromDate, toDate });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
