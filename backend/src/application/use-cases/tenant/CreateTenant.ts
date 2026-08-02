import { ConflictError } from '../../../domain/errors';

export default class CreateTenant {
  tenantRepository: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
  }

  async execute(params: any): Promise<any> {
    const { name, slug, contactEmail, contactPhone, address, branding, features, branchLimit } = params;

    const existing = await this.tenantRepository.findBySlug(slug);
    if (existing) throw new ConflictError(`Slug '${slug}' is already taken`);

    const resolvedBranding = { appName: name, ...(branding || {}) };

    return this.tenantRepository.create({
      name, slug: slug.toLowerCase(), contactEmail, contactPhone, address,
      branding: resolvedBranding,
      features: features || {},
      branchLimit,
    });
  }
}
