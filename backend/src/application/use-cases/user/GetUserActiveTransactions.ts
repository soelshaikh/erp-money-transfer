export default class GetUserActiveTransactions {
  private userRepository: any;
  private transactionRepository: any;

  constructor({ userRepository, transactionRepository }: any) {
    this.userRepository = userRepository;
    this.transactionRepository = transactionRepository;
  }

  async execute({ tenantId, userId }: any): Promise<any[]> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) return [];
    const branchId = user.branchId ? user.branchId.toString() : null;
    return this.transactionRepository.findActiveByUser(tenantId, userId, branchId);
  }
}
