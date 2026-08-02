import BranchDailyBalanceModel from '../../../infrastructure/db/models/BranchDailyBalance.model';
import BranchModel from '../../../infrastructure/db/models/Branch.model';
import { todayIST } from '../../../utils/dateIST';

export default class GetDailyTally {
  private branchRepository: any;

  constructor({ branchRepository }: any) {
    this.branchRepository = branchRepository;
  }

  async execute({ tenantId, date }: any) {
    const today = todayIST();
    const targetDate: string = date || today;
    const isToday = targetDate === today;

    // Fetch all non-HO branches for this tenant (findAllActive returns a plain array)
    const allBranches: any[] = await this.branchRepository.findAllActive(tenantId);
    const branches = (allBranches || []).filter((b: any) => b.type !== 'head_office');

    // Fetch all daily balance snapshots for this date
    const snapshots = await BranchDailyBalanceModel.find({
      tenantId,
      date: targetDate,
    }).lean();

    const snapshotMap: Record<string, any> = {};
    for (const snap of snapshots) {
      snapshotMap[String(snap.branchId)] = snap;
    }

    const branchRows: any[] = [];
    let totalOpeningBalance = 0;
    let totalClosingBalance = 0;

    for (const branch of branches) {
      const branchIdStr = String(branch._id);
      const snap = snapshotMap[branchIdStr];

      let openingBalance = 0;
      let closingBalance = 0;
      let hasSnapshot = false;

      if (snap) {
        openingBalance = snap.openingBalance || 0;
        closingBalance = snap.closingBalance || 0;
        hasSnapshot = true;
      } else if (isToday) {
        // Use live branch balance as approximation for today
        closingBalance = branch.balance || 0;
        openingBalance = branch.balance || 0;
        hasSnapshot = false;
      }

      totalOpeningBalance += openingBalance;
      totalClosingBalance += closingBalance;

      branchRows.push({
        branchId: branch._id,
        branchName: branch.name,
        branchCode: branch.code,
        openingBalance,
        closingBalance,
        dailyChange: closingBalance - openingBalance,
        hasSnapshot,
      });
    }

    const netTotal = totalClosingBalance - totalOpeningBalance;

    return {
      date: targetDate,
      branches: branchRows,
      netTotal,
      totalOpeningBalance,
      totalClosingBalance,
      isBalanced: netTotal === 0,
    };
  }
}
