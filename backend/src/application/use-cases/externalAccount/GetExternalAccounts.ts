import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';

export default class GetExternalAccounts {
  async execute({ tenantId, status, branchId, role }: any): Promise<any[]> {
    const filter: any = { tenantId };
    if (status) filter.status = status;

    const accounts = await ExternalAccountModel.find(filter)
      .populate('branchId', 'name code')
      .sort({ name: 1 })
      .lean();

    return accounts.map((acc: any) => {
      const balancesMap: Record<string, number> = acc.balances || {};
      const onHoldsMap: Record<string, number> = acc.onHolds || {};
      const totalBalance: number = acc.balance ?? 0;

      if (role === 'branch' && branchId) {
        const myBranchId = branchId.toString();
        const branchBalance: number = balancesMap[myBranchId] ?? 0;
        const branchOnHold: number = onHoldsMap[myBranchId] ?? 0;
        return { ...acc, balance: branchBalance, totalBalance, onHold: branchOnHold, available: Math.max(0, branchBalance - branchOnHold) };
      }

      // HO / super_admin: total + per-branch breakdown
      const branchBalances = Object.entries(balancesMap).map(([bId, bal]) => ({
        branchId: bId,
        balance: bal as number,
        onHold: onHoldsMap[bId] ?? 0,
        available: Math.max(0, (bal as number) - (onHoldsMap[bId] ?? 0)),
      }));
      const totalOnHold = Object.values(onHoldsMap).reduce((s: number, v: any) => s + (v ?? 0), 0);
      return { ...acc, balance: totalBalance, totalBalance, onHold: totalOnHold, branchBalances };
    });
  }
}
