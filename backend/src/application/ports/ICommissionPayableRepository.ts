export default abstract class ICommissionPayableRepository {
  abstract create(data: any): Promise<any>;
  abstract findPending(tenantId: string, fromBranchId?: string, toBranchId?: string): Promise<any[]>;
  abstract findAll(tenantId: string, filters: any): Promise<{ data: any[]; total: number; page: number; limit: number }>;
  abstract reserveForSettlement(tenantId: string, ids: string[], settlementId: string): Promise<void>;
  abstract markSettled(tenantId: string, ids: string[]): Promise<void>;
  abstract releaseFromSettlement(tenantId: string, settlementId: string): Promise<void>;
  abstract getPendingSummary(tenantId: string): Promise<any[]>;
}
