/**
 * Port (abstract interface) for transaction persistence.
 * Domain and use-cases depend on this — never on MongoTransactionRepository directly.
 */
export default class ITransactionRepository {
  /** @returns {Promise<Transaction>} */
  async create(transactionEntity: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Transaction|null>} */
  async findById(tenantId: any, id: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Transaction|null>} */
  async findByTokenNumber(tenantId: any, tokenNumber: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * Atomic approve — uses findOneAndUpdate with { approvalStatus: 'pending' } pre-condition.
   * Returns null if already approved/rejected (race condition guard).
   * @returns {Promise<Transaction|null>}
   */
  async approveAtomic(tenantId: any, id: any, userId: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * Atomic reject — same race condition guard as approveAtomic.
   * @returns {Promise<Transaction|null>}
   */
  async rejectAtomic(tenantId: any, id: any, userId: any, remarks: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<Transaction>} */
  async completePayment(tenantId: any, id: any): Promise<any> { throw new Error('Not implemented'); }

  /**
   * @param {object} filters - { branchId, status, fromDate, toDate, page, limit }
   * @returns {Promise<{ data: Transaction[], total: number, page: number, limit: number }>}
   */
  async findAll(tenantId: any, filters: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<number>} Daily sequence for token number generation */
  async getDailySequence(tenantId: any, branchCode: any, dateStr: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<object>} Aggregated dashboard stats */
  async getDashboardStats(tenantId: any, filters: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<{ branches, grandTotal }>} Per-branch commission totals */
  async getCommissionSummary(tenantId: any, filters: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<{ data, total, totals }>} Paginated transactions with commission fields */
  async getCommissionDetail(tenantId: any, filters: any): Promise<any> { throw new Error('Not implemented'); }

  /** @returns {Promise<number>} Total amount collected by a branch today (in rupees) */
  async sumTodayByBranch(tenantId: any, branchId: any): Promise<number> { throw new Error('Not implemented'); }

  /** @returns {Promise<any[]>} Branch-to-branch flow matrix aggregation */
  async getFlowMatrix(_tenantId: any, _filters: any): Promise<any> { throw new Error('not implemented'); }

  /** @returns {Promise<any[]>} Staff transaction activity report aggregation */
  async getStaffReport(_tenantId: any, _filters: any): Promise<any> { throw new Error('not implemented'); }
}
