export default class IBranchRepository {
  /** @returns {Promise<Branch>} */
  async create(branchEntity: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Branch|null>} */
  async findById(tenantId: any, id: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Branch|null>} */
  async findByCode(tenantId: any, code: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Branch>} */
  async update(tenantId: any, id: any, updates: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * @param {object} filters - { type, status, page, limit }
   * @returns {Promise<{ data: Branch[], total: number }>}
   */
  async findAll(tenantId: any, filters: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Branch[]>} For dropdowns — no pagination */
  async findAllActive(tenantId: any): Promise<any> { throw new Error('Not implemented'); }

  /** Count active non-head-office branches for branch limit enforcement */
  async countNonHeadOffice(tenantId: any): Promise<number> { throw new Error('Not implemented'); }

  /** Returns the head_office type branch for the tenant, or null if none exists */
  async findHeadOfficeBranch(tenantId: string): Promise<any | null> { throw new Error('Not implemented'); }
}
