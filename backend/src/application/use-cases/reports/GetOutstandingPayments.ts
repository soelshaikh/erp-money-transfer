export default class GetOutstandingPayments {
  private transactionRepository: any;

  constructor({ transactionRepository }: any) {
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, role, branchId, page = 1, limit = 20 }: any) {
    const filters: any = {
      approvalStatus: 'approved',
      paymentStatus: 'pending',
      page: Number(page),
      limit: Number(limit),
    };

    if (role === 'branch' && branchId) {
      filters.branchId = branchId;
      filters.branchRole = 'payout';
    }

    const result = await this.transactionRepository.findAll(tenantId, filters);

    return {
      data: (result.data || []).map((tx: any) => ({
        _id: tx._id,
        tokenNumber: tx.tokenNumber,
        amount: tx.amount,
        commissionAmount: tx.commissionAmount,
        finalAmount: tx.finalAmount,
        collectionBranchId: tx.collectionBranchId
          ? { _id: tx.collectionBranchId._id, name: tx.collectionBranchId.name, code: tx.collectionBranchId.code }
          : null,
        payoutBranchId: tx.payoutBranchId
          ? { _id: tx.payoutBranchId._id, name: tx.payoutBranchId.name, code: tx.payoutBranchId.code }
          : null,
        createdAt: tx.createdAt,
        approvedAt: tx.approvedAt,
        createdBy: tx.createdBy ? { _id: tx.createdBy._id, name: tx.createdBy.name } : null,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
