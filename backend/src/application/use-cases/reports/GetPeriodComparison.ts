import { toISTDate } from '../../../utils/dateIST';

export default class GetPeriodComparison {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  private _getDateRange(period: string): { currentStart: Date; currentEnd: Date; previousStart: Date; previousEnd: Date } {
    const now = new Date();

    if (period === 'week') {
      const currentEnd = new Date(now);
      currentEnd.setHours(23, 59, 59, 999);
      const currentStart = new Date(now);
      currentStart.setDate(currentStart.getDate() - 6);
      currentStart.setHours(0, 0, 0, 0);

      const previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousEnd.setHours(23, 59, 59, 999);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - 6);
      previousStart.setHours(0, 0, 0, 0);

      return { currentStart, currentEnd, previousStart, previousEnd };
    }

    if (period === 'month') {
      const currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      return { currentStart, currentEnd, previousStart, previousEnd };
    }

    // quarter
    const quarter = Math.floor(now.getMonth() / 3);
    const currentStart = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
    const currentEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);

    const prevQuarter = quarter - 1;
    const prevYear = prevQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevQ = ((prevQuarter % 4) + 4) % 4;
    const previousStart = new Date(prevYear, prevQ * 3, 1, 0, 0, 0, 0);
    const previousEnd = new Date(prevYear, prevQ * 3 + 3, 0, 23, 59, 59, 999);

    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  private async _getStats(tenantId: any, branchId: any, role: string, fromDate: Date, toDate: Date) {
    const filters: any = { fromDate, toDate };
    if (role === 'branch' && branchId) {
      filters.branchId = branchId;
    }
    const stats = await this.transactionRepository.getDashboardStats(tenantId, filters);
    return {
      count: stats.totalTransactions || 0,
      totalAmount: stats.totalAmount || 0,
      totalCommission: stats.totalCommission || 0,
      completedCount: stats.completedCount || 0,
    };
  }

  private _pct(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  async execute({ tenantId, role, branchId, period = 'week' }: any) {
    const { currentStart, currentEnd, previousStart, previousEnd } = this._getDateRange(period);

    const [current, previous] = await Promise.all([
      this._getStats(tenantId, branchId, role, currentStart, currentEnd),
      this._getStats(tenantId, branchId, role, previousStart, previousEnd),
    ]);

    return {
      period,
      current: {
        startDate: toISTDate(currentStart),
        endDate: toISTDate(currentEnd),
        ...current,
      },
      previous: {
        startDate: toISTDate(previousStart),
        endDate: toISTDate(previousEnd),
        ...previous,
      },
      growth: {
        countPct: this._pct(current.count, previous.count),
        amountPct: this._pct(current.totalAmount, previous.totalAmount),
        commissionPct: this._pct(current.totalCommission, previous.totalCommission),
      },
    };
  }
}
