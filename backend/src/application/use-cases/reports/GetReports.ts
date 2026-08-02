import { ROLES } from '../../../config/constants';
import { toISTDate, toISTMonth } from '../../../utils/dateIST';

export default class GetReports {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, branchId, role, startDate, endDate, type = 'daily' }: any): Promise<any> {
    const filters: any = { limit: 5000 };
    if (branchId && role === ROLES.BRANCH) filters.branchId = branchId;
    if (startDate) filters.fromDate = startDate;
    if (endDate) filters.toDate = endDate;

    const result = await this.transactionRepository.findAll(tenantId, filters);
    const transactions: any[] = result.data || result || [];

    const summary = {
      totalTransactions: transactions.length,
      totalAmountPaisa: transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0),
      totalCommissionPaisa: transactions.reduce((sum: number, tx: any) => sum + (tx.commissionAmount || 0), 0),
      completedCount: transactions.filter((tx: any) => tx.paymentStatus === 'completed').length,
      pendingCount: transactions.filter((tx: any) => tx.paymentStatus === 'pending').length,
      approvedCount: transactions.filter((tx: any) => tx.approvalStatus === 'approved').length,
      rejectedCount: transactions.filter((tx: any) => tx.approvalStatus === 'rejected').length,
    };

    let branchBreakdown: any[] = [];
    if (role === ROLES.HEAD_OFFICE) {
      const branchMap = new Map<string, any>();
      for (const tx of transactions) {
        const bid = tx.collectionBranchId?._id?.toString() || tx.collectionBranchId?.toString() || 'unknown';
        const bname = tx.collectionBranchId?.name || 'Unknown Branch';
        if (!branchMap.has(bid)) branchMap.set(bid, { branchId: bid, branchName: bname, count: 0, totalAmountPaisa: 0 });
        const entry = branchMap.get(bid);
        entry.count++;
        entry.totalAmountPaisa += tx.amount || 0;
      }
      branchBreakdown = Array.from(branchMap.values());
    }

    let dailyBreakdown: any[] = [];
    let monthlyBreakdown: any[] = [];

    if (type === 'daily') {
      const map = new Map<string, { count: number; totalAmount: number; totalCommission: number }>();
      for (const tx of transactions) {
        const date = toISTDate(tx.createdAt);
        const e = map.get(date) || { count: 0, totalAmount: 0, totalCommission: 0 };
        e.count++;
        e.totalAmount += tx.amount || 0;
        e.totalCommission += tx.commissionAmount || 0;
        map.set(date, e);
      }
      dailyBreakdown = Array.from(map.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    if (type === 'monthly') {
      const map = new Map<string, { count: number; totalAmount: number; totalCommission: number }>();
      for (const tx of transactions) {
        const month = toISTMonth(tx.createdAt);
        const e = map.get(month) || { count: 0, totalAmount: 0, totalCommission: 0 };
        e.count++;
        e.totalAmount += tx.amount || 0;
        e.totalCommission += tx.commissionAmount || 0;
        map.set(month, e);
      }
      monthlyBreakdown = Array.from(map.entries())
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }

    return {
      summary,
      branchBreakdown,
      dailyBreakdown,
      monthlyBreakdown,
      transactions: transactions.slice(0, 100),
      filters: { startDate, endDate, type },
    };
  }
}
