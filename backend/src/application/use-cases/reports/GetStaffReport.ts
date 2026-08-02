export default class GetStaffReport {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, role, branchId, fromDate, toDate }: any) {
    const filters: any = {};
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    if (role === 'branch' && branchId) {
      filters.branchId = branchId;
    }

    const staff = await this.transactionRepository.getStaffReport(tenantId, filters);

    return { staff };
  }
}
