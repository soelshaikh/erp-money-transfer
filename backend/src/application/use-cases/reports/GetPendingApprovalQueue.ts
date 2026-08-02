export default class GetPendingApprovalQueue {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, role, branchId, page = 1, limit = 20 }: any) {
    const filters: any = {
      approvalStatus: 'pending',
      page: Number(page),
      limit: Number(limit),
    };

    if (role === 'branch' && branchId) {
      filters.branchId = branchId;
      filters.branchRole = 'collection';
    }

    const result = await this.transactionRepository.findAll(tenantId, filters);
    // Sort oldest first
    if (result.data) {
      result.data.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return {
      data: (result.data || []).map((tx: any) => ({
        _id: tx._id,
        tokenNumber: tx.tokenNumber,
        amount: tx.amount,
        commissionAmount: tx.commissionAmount,
        collectionBranchId: tx.collectionBranchId
          ? { _id: tx.collectionBranchId._id, name: tx.collectionBranchId.name, code: tx.collectionBranchId.code }
          : null,
        payoutBranchId: tx.payoutBranchId
          ? { _id: tx.payoutBranchId._id, name: tx.payoutBranchId.name, code: tx.payoutBranchId.code }
          : null,
        createdAt: tx.createdAt,
        createdBy: tx.createdBy ? { _id: tx.createdBy._id, name: tx.createdBy.name } : null,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
