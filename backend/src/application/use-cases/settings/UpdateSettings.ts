import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class UpdateSettings {
  tenantRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, branding, features, settings, userId } = params;

    const before = await this.tenantRepository.findById(tenantId);
    if (!before) throw new NotFoundError('Tenant');

    const updates: any = {};
    if (branding) {
      Object.entries(branding).forEach(([k, v]) => { updates[`branding.${k}`] = v; });
    }
    if (features) {
      Object.entries(features).forEach(([k, v]) => { updates[`features.${k}`] = v; });
    }
    if (settings) {
      Object.entries(settings).forEach(([k, v]) => { updates[`settings.${k}`] = v; });
    }

    // Transaction limits are super-admin-only — strip them so head office cannot change them
    Object.keys(updates).forEach(k => {
      if (k.startsWith('settings.transactionLimits')) delete updates[k];
    });

    const tenant = await this.tenantRepository.update(tenantId, updates);

    this.auditService.log({
      tenantId, userId, action: AUDIT_ACTIONS.UPDATE,
      module: MODULES.SETTINGS, entityId: tenantId,
      before: { branding: before.branding, features: before.features, settings: before.settings },
      after: { branding, features, settings },
    });

    return { branding: tenant.branding, features: tenant.features, settings: tenant.settings };
  }
}
