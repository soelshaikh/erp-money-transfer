export default class GetTransactions {
  transactionRepository: any;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, filters } = params;
    return this.transactionRepository.findAll(tenantId, filters);
  }
}
