export default class ITenantRepository {
  /** @returns {Promise<Tenant>} */
  async create(tenantData: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Tenant|null>} */
  async findById(id: any): Promise<any> { throw new Error('Not implemented'); } // no tenantId scoping — cross-tenant

  /** @returns {Promise<Tenant|null>} */
  async findBySlug(slug: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Tenant>} */
  async update(id: any, updates: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Tenant>} Used to update branding, features, settings */
  async updateSettings(id: any, settings: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * @param {object} filters - { status, page, limit }
   * @returns {Promise<{ data: Tenant[], total: number }>}
   */
  async findAll(filters: any): Promise<any> { throw new Error('Not implemented'); }
}
