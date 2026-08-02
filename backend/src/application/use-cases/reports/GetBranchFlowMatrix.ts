export default class GetBranchFlowMatrix {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, fromDate, toDate, approvalStatus, paymentStatus }: any) {
    const filters: any = {};
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    if (approvalStatus) filters.approvalStatus = approvalStatus;
    if (paymentStatus) filters.paymentStatus = paymentStatus;

    const corridors = await this.transactionRepository.getFlowMatrix(tenantId, filters);

    return {
      corridors,
      totalCorridors: corridors.length,
    };
  }
}
