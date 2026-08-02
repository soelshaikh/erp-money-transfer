/**
 * Port for audit logging.
 * Fire-and-forget — use-cases call log() without awaiting in critical paths.
 */
export default class IAuditService {
  /**
   * @param {object} entry
   * @param {string} entry.tenantId
   * @param {string} entry.userId
   * @param {string} entry.action    - AUDIT_ACTIONS constant
   * @param {string} entry.module    - MODULES constant
   * @param {string} [entry.entityId]
   * @param {object} [entry.before]  - Snapshot before change
   * @param {object} [entry.after]   - Snapshot after change
   * @param {string} [entry.ip]
   * @param {string} [entry.userAgent]
   */
  async log(entry: any): Promise<any> { throw new Error('Not implemented'); }
}
