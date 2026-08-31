export default class GetBranchCollectionReport {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, fromDate, toDate }: any) {
    const filters: any = { limit: 5000, page: 1 };
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    const result = await this.transactionRepository.findAll(tenantId, filters);
    const transactions: any[] = result.data || [];

    const map: Record<string, any> = {};

    const ensureBranch = (id: any, nameObj: any) => {
      const key = String(id);
      if (!map[key]) {
        map[key] = {
          branchId: id,
          branchName: nameObj?.name || '',
          branchCode: nameObj?.code || '',
          collection: { count: 0, totalAmount: 0, totalCommission: 0 },
          payout: { count: 0, totalFinalAmount: 0, totalCommission: 0 },
        };
      }
    };

    for (const tx of transactions) {
      // earningBranchId = commissionSplit.earningBranchId ?? collectionBranchId (mirrors getCommissionSummary logic)
      const rawEarner = tx.commissionSplit?.earningBranchId;
      const earnerStr: string | null = rawEarner ? String(rawEarner._id || rawEarner) : null;

      // Collection side
      if (tx.collectionBranchId) {
        const cId = tx.collectionBranchId._id || tx.collectionBranchId;
        const cStr = String(cId);
        ensureBranch(cId, tx.collectionBranchId);
        const entry = map[cStr];
        entry.collection.count += 1;
        entry.collection.totalAmount += tx.amount || 0;
        // Earns when no explicit earner (defaults to collection) OR explicitly named
        if (!earnerStr || earnerStr === cStr) {
          entry.collection.totalCommission += tx.commissionAmount || 0;
        }
      }
      // Payout side
      if (tx.payoutBranchId) {
        const pId = tx.payoutBranchId._id || tx.payoutBranchId;
        const pStr = String(pId);
        ensureBranch(pId, tx.payoutBranchId);
        const entry = map[pStr];
        entry.payout.count += 1;
        entry.payout.totalFinalAmount += tx.finalAmount || 0;
        // Earns only when explicitly named as the earner (payout_extra mode)
        if (earnerStr === pStr) {
          entry.payout.totalCommission += tx.commissionAmount || 0;
        }
      }
    }

    const branches = Object.values(map).sort((a, b) =>
      (b.collection.totalAmount + b.payout.totalFinalAmount) -
      (a.collection.totalAmount + a.payout.totalFinalAmount)
    );

    return { branches };
  }
}
