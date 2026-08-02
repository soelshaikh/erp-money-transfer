import BranchDailyBalanceModel from '../../../infrastructure/db/models/BranchDailyBalance.model';
import BranchModel from '../../../infrastructure/db/models/Branch.model';

export default class GetAllBranchDailyBalances {
  private branchRepository: any;

  constructor({ branchRepository }: any) {
    this.branchRepository = branchRepository;
  }

  async execute({ tenantId, fromDate, toDate }: any) {
    // Build query for date range
    const query: any = { tenantId };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate.slice(0, 10);
      if (toDate) query.date.$lte = toDate.slice(0, 10);
    }

    const snapshots = await BranchDailyBalanceModel.find(query).sort({ date: 1 }).lean();

    // Fetch branch name/code info (findAllActive returns a plain array)
    const allBranches: any[] = await this.branchRepository.findAllActive(tenantId);
    const branchInfoMap: Record<string, any> = {};
    for (const b of (allBranches || [])) {
      branchInfoMap[String(b._id)] = { branchName: b.name, branchCode: b.code };
    }

    // Group by date
    const dateMap: Record<string, any[]> = {};
    for (const snap of snapshots) {
      const d = snap.date;
      if (!dateMap[d]) dateMap[d] = [];
      const info = branchInfoMap[String(snap.branchId)] || {};
      dateMap[d].push({
        branchId: snap.branchId,
        branchName: info.branchName || '',
        branchCode: info.branchCode || '',
        openingBalance: snap.openingBalance || 0,
        closingBalance: snap.closingBalance || 0,
      });
    }

    const dates = Object.keys(dateMap)
      .sort()
      .map((date) => {
        const branches = dateMap[date];
        const netClosing = branches.reduce((s: number, b: any) => s + (b.closingBalance || 0), 0);
        return { date, branches, netClosing };
      });

    return { dates };
  }
}
