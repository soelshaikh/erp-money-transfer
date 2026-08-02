import { ROLES } from '../../../config/constants';
import { todayIST } from '../../../utils/dateIST';

export default class GetDashboard {
  transactionRepository: any;
  branchRepository: any;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
    this.branchRepository = deps.branchRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, userId, role, branchId, fromDate: fromParam, toDate: toParam } = params;

    const today = todayIST();
    const fromDate = fromParam || today;
    const toDate = toParam || today;

    const filters: any = { fromDate, toDate };

    // Branch sees all transactions involving their branch (both collection and payout)
    if (role === ROLES.BRANCH && branchId) {
      filters.branchId = branchId;
    }

    const allTimeFilters = role === ROLES.BRANCH && branchId ? { branchId } : {};

    const [todayStats, allTimeStats] = await Promise.all([
      this.transactionRepository.getDashboardStats(tenantId, { ...filters }),
      this.transactionRepository.getDashboardStats(tenantId, allTimeFilters),
    ]);

    const result: any = { today: todayStats, allTime: allTimeStats };

    if (role === ROLES.BRANCH && branchId) {
      const branch = await this.branchRepository.findById(tenantId, branchId);
      if (branch) {
        result.balance = branch.balance ?? 0;
        result.committedPayout = branch.committedPayout ?? 0;
        result.pendingPayout = branch.pendingPayout ?? 0;
        result.payoutCompleted = branch.payoutCompleted ?? 0;
      }
    }

    // Head office and super admin also get branch count
    if (role === ROLES.HEAD_OFFICE || role === ROLES.SUPER_ADMIN) {
      const branches = await this.branchRepository.findAll(tenantId, { limit: 1 });
      result.totalBranches = branches.total;
    }

    return result;
  }
}
