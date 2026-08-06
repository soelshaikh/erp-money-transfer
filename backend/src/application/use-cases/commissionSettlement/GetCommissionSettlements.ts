export default class GetCommissionSettlements {
  commissionSettlementRepository: any;

  constructor(deps: any) {
    this.commissionSettlementRepository = deps.commissionSettlementRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, fromBranchId, toBranchId, status, fromDate, toDate, page, limit } = params;
    return this.commissionSettlementRepository.findAll(tenantId, {
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
