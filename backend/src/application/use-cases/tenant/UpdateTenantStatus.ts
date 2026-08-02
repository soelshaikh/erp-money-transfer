import { NotFoundError } from '../../../domain/errors';

export default class UpdateTenantStatus {
  tenantRepository: any;
  notificationService: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
    this.notificationService = deps.notificationService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, status } = params;

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');

    const updated = await this.tenantRepository.update(tenantId, { status });

    // Force-logout all users of this company when disabled or suspended
    if (status === 'inactive' || status === 'suspended') {
      await this.notificationService.forceLogoutTenant(tenantId);
    }

    return updated;
  }
}
