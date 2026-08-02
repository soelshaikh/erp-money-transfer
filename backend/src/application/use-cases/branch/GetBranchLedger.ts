import { NotFoundError } from '../../../domain/errors';

export default class GetBranchLedger {
  branchRepository: any;
  branchLedgerRepository: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
    this.branchLedgerRepository = deps.branchLedgerRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, branchId, filters = {} } = params;

    const branch = await this.branchRepository.findById(tenantId, branchId);
    if (!branch) throw new NotFoundError('Branch');

    const [ledger, openingBalance] = await Promise.all([
      this.branchLedgerRepository.findByBranch(tenantId, branchId, filters),
      filters.fromDate
        ? this.branchLedgerRepository.getOpeningBalanceForDate(tenantId, branchId, filters.fromDate)
        : Promise.resolve(null),
    ]);

    const actualBalance = branch.balance ?? 0;
    const committedPayout = branch.committedPayout ?? 0;
    const pendingPayout = branch.pendingPayout ?? 0;
    const payoutCompleted = branch.payoutCompleted ?? 0;
    const effectiveBalance = actualBalance - committedPayout - pendingPayout + payoutCompleted;

    return {
      branch: {
        id: branch._id,
        name: branch.name,
        code: branch.code,
        type: branch.type,
        actualBalance,
        committedPayout,
        pendingPayout,
        payoutCompleted,
        effectiveBalance,
        openingBalance,
      },
      ...ledger,
    };
  }
}
