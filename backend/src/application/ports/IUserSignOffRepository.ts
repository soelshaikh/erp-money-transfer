export default interface IUserSignOffRepository {
  upsert(data: { tenantId: any; userId: any; branchId: any; date: string; signedOffAt: Date }): Promise<any>;
  findByUserAndDate(tenantId: any, userId: any, date: string): Promise<any | null>;
  findByDate(tenantId: any, date: string): Promise<any[]>;
  enableReLogin(tenantId: any, id: any, enabledBy: any): Promise<any | null>;
}
