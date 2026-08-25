import { ConflictError } from '../../../domain/errors';

export default class CreateTenant {
  tenantRepository: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
  }

  async execute(params: any): Promise<any> {
    const { name, slug, contactEmail, contactPhone, address, branding, features, branchLimit, businessType, settings } = params;

    const existing = await this.tenantRepository.findBySlug(slug);
    if (existing) throw new ConflictError(`Slug '${slug}' is already taken`);

    const resolvedBranding = { appName: name, ...(branding || {}) };

    // Aangadia-style operations traditionally use a flat commission; enterprise defaults to percentage.
    // Either can still be changed later via the commission settings screen.
    const defaultCommissionType = businessType === 'aangadia' ? 'flat' : 'percentage';
    const resolvedSettings = {
      ...(settings || {}),
      commission: {
        type: defaultCommissionType,
        value: 0,
        ...(settings?.commission || {}),
      },
    };

    return this.tenantRepository.create({
      name, slug: slug.toLowerCase(), contactEmail, contactPhone, address,
      businessType,
      branding: resolvedBranding,
      features: features || {},
      settings: resolvedSettings,
      branchLimit,
    });
  }
}
