export default class IBranchLedgerRepository {
  async addEntry(tenantId: any, branchId: any, entry: any): Promise<any> { throw new Error('Not implemented'); }
  async findByBranch(tenantId: any, branchId: any, filters?: any): Promise<any> { throw new Error('Not implemented'); }
  async getOpeningBalanceForDate(tenantId: any, branchId: any, fromDate: string): Promise<number> { throw new Error('Not implemented'); }
  async getDailyBalances(tenantId: any, branchId: any, filters?: any): Promise<any> { throw new Error('Not implemented'); }
}
