import { NotFoundError } from '../../../domain/errors';

export default class GetSettings {
  tenantRepository: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId } = params;

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant');
    return {
      branding: tenant.branding,
      features: tenant.features,
      settings: tenant.settings,
    };
  }
}
