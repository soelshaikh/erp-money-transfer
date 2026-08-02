import { NotFoundError } from '../../../domain/errors';

export default class GetTransaction {
  transactionRepository: any;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, transactionId } = params;

    const transaction = await this.transactionRepository.findById(tenantId, transactionId);
    if (!transaction) throw new NotFoundError('Transaction');
    return transaction;
  }
}
