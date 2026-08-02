import { NotFoundError, BusinessRuleError } from '../../../domain/errors';

export default class UpdateTenantBranchLimit {
  tenantRepository: any;
  branchRepository: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
    this.branchRepository = deps.branchRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, branchLimit } = params;

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const currentCount = await this.branchRepository.countNonHeadOffice(tenantId);
    if (branchLimit < currentCount) {
      throw new BusinessRuleError(
        `Cannot set limit to ${branchLimit}. This company already has ${currentCount} branch${currentCount === 1 ? '' : 'es'}.`
      );
    }

    return this.tenantRepository.update(tenantId, { branchLimit });
  }
}
