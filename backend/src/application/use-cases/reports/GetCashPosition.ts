export default class GetCashPosition {
  private branchRepository: any;

  constructor({ branchRepository }: any) {
    this.branchRepository = branchRepository;
  }

  async execute({ tenantId }: any) {
    const allBranches: any[] = await this.branchRepository.findAllActive(tenantId);
    const branches = (allBranches || []).filter((b: any) => b.type !== 'head_office');

    let totalActualBalance = 0;
    let totalCommittedPayout = 0;
    let totalEffectiveBalance = 0;

    const branchRows = branches.map((b: any) => {
      const balance = b.balance || 0;
      const committedPayout = b.committedPayout || 0;
      const pendingPayout = b.pendingPayout || 0;
      const payoutCompleted = b.payoutCompleted || 0;
      const effectiveBalance = balance - committedPayout - pendingPayout + payoutCompleted;

      totalActualBalance += balance;
      totalCommittedPayout += committedPayout;
      totalEffectiveBalance += effectiveBalance;

      return {
        branchId: b._id,
        branchName: b.name,
        branchCode: b.code,
        actualBalance: balance,
        committedPayout,
        pendingPayout,
        payoutCompleted,
        effectiveBalance,
      };
    });

    return {
      branches: branchRows,
      totals: {
        actualBalance: totalActualBalance,
        committedPayout: totalCommittedPayout,
        effectiveBalance: totalEffectiveBalance,
      },
    };
  }
}
