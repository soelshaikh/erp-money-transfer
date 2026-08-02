import { NotFoundError } from '../../../domain/errors';

export default class GetBranchDailyBalances {
  branchRepository: any;
  branchLedgerRepository: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
    this.branchLedgerRepository = deps.branchLedgerRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, branchId, filters = {} } = params;

    const branch = await this.branchRepository.findById(tenantId, branchId);
    if (!branch) throw new NotFoundError('Branch');

    const result = await this.branchLedgerRepository.getDailyBalances(tenantId, branchId, filters);

    return {
      branch: {
        id: branch._id,
        name: branch.name,
        code: branch.code,
        type: branch.type,
      },
      ...result,
    };
  }
}
