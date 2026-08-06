export default abstract class ICommissionSettlementRepository {
  abstract create(data: any): Promise<any>;
  abstract findById(tenantId: string, id: string): Promise<any>;
  abstract findAll(tenantId: string, filters: any): Promise<{ data: any[]; total: number; page: number; limit: number }>;
  abstract complete(tenantId: string, id: string, completedBy: string, completedByName: string): Promise<any>;
}
