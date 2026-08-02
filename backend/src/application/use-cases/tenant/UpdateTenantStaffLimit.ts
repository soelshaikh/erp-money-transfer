import { NotFoundError, BusinessRuleError } from '../../../domain/errors';

export default class UpdateTenantStaffLimit {
  tenantRepository: any;
  userRepository: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
    this.userRepository = deps.userRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, staffLimit } = params;

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const currentCount = await this.userRepository.countActiveByTenant(tenantId);
    if (staffLimit < currentCount) {
      throw new BusinessRuleError(
        `Cannot set limit to ${staffLimit}. This company already has ${currentCount} active staff member${currentCount === 1 ? '' : 's'}.`
      );
    }

    return this.tenantRepository.update(tenantId, { staffLimit });
  }
}
