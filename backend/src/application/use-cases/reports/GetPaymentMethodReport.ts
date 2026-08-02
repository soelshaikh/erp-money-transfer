export default class GetPaymentMethodReport {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, role, branchId, fromDate, toDate }: any) {
    const filters: any = { limit: 5000, page: 1 };
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;
    if (role === 'branch' && branchId) {
      filters.branchId = branchId;
    }

    const result = await this.transactionRepository.findAll(tenantId, filters);
    const transactions: any[] = result.data || [];

    const map: Record<string, any> = {};

    for (const tx of transactions) {
      const method = tx.paymentMethod || 'unknown';
      if (!map[method]) {
        map[method] = { method, count: 0, totalAmount: 0, totalCommission: 0, totalFinalAmount: 0 };
      }
      map[method].count += 1;
      map[method].totalAmount += tx.amount || 0;
      map[method].totalCommission += tx.commissionAmount || 0;
      map[method].totalFinalAmount += tx.finalAmount || 0;
    }

    const methods = Object.values(map).sort((a, b) => b.count - a.count);

    return {
      methods,
      summary: {
        totalCount: transactions.length,
        totalAmount: transactions.reduce((s, tx) => s + (tx.amount || 0), 0),
      },
    };
  }
}
