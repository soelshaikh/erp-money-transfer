export default class GetCommissionPayables {
  commissionPayableRepository: any;

  constructor(deps: any) {
    this.commissionPayableRepository = deps.commissionPayableRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, fromBranchId, toBranchId, status, fromDate, toDate, page, limit, summaryOnly } = params;

    if (summaryOnly) {
      const summary = await this.commissionPayableRepository.getPendingSummary(tenantId);
      return { summary };
    }

    return this.commissionPayableRepository.findAll(tenantId, {
      fromBranchId,
      toBranchId,
      status,
      fromDate,
      toDate,
      page: Number(page) || 1,
      limit: Number(limit) || 30,
    });
  }
}
