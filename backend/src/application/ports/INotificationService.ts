/**
 * Port for real-time in-app notifications (WebSocket).
 * Swap to push notifications or email by replacing the adapter — use-cases don't change.
 */
export default class INotificationService {
  /**
   * Send real-time notification to all users of a specific role within the tenant.
   * @param {string} tenantId
   * @param {string} role - Target role (e.g., ROLES.HEAD_OFFICE)
   * @param {object} payload - { type, title, body, data }
   */
  async notifyRole(tenantId: any, role: any, payload: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * Send notification to a specific user by ID.
   */
  async notifyUser(tenantId: any, userId: any, payload: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * Send notification to all users of a specific branch.
   */
  async notifyBranch(tenantId: any, branchId: any, payload: any): Promise<any> { throw new Error('Not implemented'); }

  /** Force-disconnect a specific user immediately (disabled user). */
  async forceLogoutUser(tenantId: any, userId: any): Promise<void> { throw new Error('Not implemented'); }

  /** Force-disconnect all users of a specific branch (branch disabled). */
  async forceLogoutBranch(tenantId: any, branchId: any): Promise<void> { throw new Error('Not implemented'); }

  /** Force-disconnect all users of a tenant (company disabled/suspended). */
  async forceLogoutTenant(tenantId: any): Promise<void> { throw new Error('Not implemented'); }
}
