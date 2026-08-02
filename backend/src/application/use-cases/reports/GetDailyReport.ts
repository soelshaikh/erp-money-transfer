import { toISTDate } from '../../../utils/dateIST';

export default class GetDailyReport {
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
      // both sides included — findAll with branchId and no branchRole uses $or
    }

    const result = await this.transactionRepository.findAll(tenantId, filters);
    const transactions: any[] = result.data || [];

    const map: Record<string, any> = {};

    for (const tx of transactions) {
      const date = toISTDate(tx.createdAt);
      if (!map[date]) {
        map[date] = {
          date,
          count: 0,
          totalAmount: 0,
          totalCommission: 0,
          totalFinalAmount: 0,
          pendingCount: 0,
          approvedCount: 0,
          completedCount: 0,
          rejectedCount: 0,
        };
      }
      const row = map[date];
      row.count += 1;
      row.totalAmount += tx.amount || 0;
      row.totalCommission += tx.commissionAmount || 0;
      row.totalFinalAmount += tx.finalAmount || 0;
      if (tx.approvalStatus === 'pending') row.pendingCount += 1;
      if (tx.approvalStatus === 'approved') row.approvedCount += 1;
      if (tx.approvalStatus === 'rejected') row.rejectedCount += 1;
      if (tx.paymentStatus === 'completed') row.completedCount += 1;
    }

    const rows = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));

    const summary = {
      totalCount: transactions.length,
      totalAmount: transactions.reduce((s, tx) => s + (tx.amount || 0), 0),
      totalCommission: transactions.reduce((s, tx) => s + (tx.commissionAmount || 0), 0),
    };

    return { rows, summary };
  }
}
