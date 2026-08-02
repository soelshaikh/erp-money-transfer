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
      // Collection side
      if (tx.collectionBranchId) {
        const cId = tx.collectionBranchId._id || tx.collectionBranchId;
        ensureBranch(cId, tx.collectionBranchId);
        const entry = map[String(cId)];
        entry.collection.count += 1;
        entry.collection.totalAmount += tx.amount || 0;
        if (tx.commissionSide !== 'payout') {
          entry.collection.totalCommission += tx.commissionAmount || 0;
        }
      }
      // Payout side
      if (tx.payoutBranchId) {
        const pId = tx.payoutBranchId._id || tx.payoutBranchId;
        ensureBranch(pId, tx.payoutBranchId);
        const entry = map[String(pId)];
        entry.payout.count += 1;
        entry.payout.totalFinalAmount += tx.finalAmount || 0;
        if (tx.commissionSide === 'payout') {
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
