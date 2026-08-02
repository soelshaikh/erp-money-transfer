export default class GetRejectedTransactions {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, role, branchId, fromDate, toDate, page = 1, limit = 20 }: any) {
    const filters: any = {
      approvalStatus: 'rejected',
      page: Number(page),
      limit: Number(limit),
    };

    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    if (role === 'branch' && branchId) {
      filters.branchId = branchId;
    }

    const result = await this.transactionRepository.findAll(tenantId, filters);

    return {
      data: (result.data || []).map((tx: any) => ({
        _id: tx._id,
        tokenNumber: tx.tokenNumber,
        amount: tx.amount,
        remarks: tx.remarks,
        collectionBranchId: tx.collectionBranchId
          ? { _id: tx.collectionBranchId._id, name: tx.collectionBranchId.name, code: tx.collectionBranchId.code }
          : null,
        payoutBranchId: tx.payoutBranchId
          ? { _id: tx.payoutBranchId._id, name: tx.payoutBranchId.name, code: tx.payoutBranchId.code }
          : null,
        approvedBy: tx.approvedBy ? { _id: tx.approvedBy._id, name: tx.approvedBy.name } : null,
        approvedAt: tx.approvedAt,
        createdAt: tx.createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
