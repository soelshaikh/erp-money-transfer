export default class IUserRepository {
  /** @returns {Promise<User>} */
  async create(userEntity: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<User|null>} */
  async findById(tenantId: any, id: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<User|null>} Includes passwordHash for login verification */
  async findByUsername(tenantId: any, username: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<User>} */
  async update(tenantId: any, id: any, updates: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<void>} */
  async updatePassword(tenantId: any, id: any, passwordHash: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<void>} */
  async updateLastLogin(tenantId: any, id: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * @param {object} filters - { role, branchId, status, page, limit }
   * @returns {Promise<{ data: User[], total: number }>}
   */
  async findAll(tenantId: any, filters: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<boolean>} */
  async usernameExists(tenantId: any, username: any): Promise<any> { throw new Error('Not implemented'); }

  async countActiveByTenant(tenantId: string): Promise<number> { throw new Error('Not implemented'); }

  async addDevice(tenantId: any, userId: any, device: any): Promise<any> { throw new Error('Not implemented'); }
  async removeDevice(tenantId: any, userId: any, deviceId: any): Promise<any> { throw new Error('Not implemented'); }
  async getDevices(tenantId: any, userId: any): Promise<any> { throw new Error('Not implemented'); }
}
