export default class ListDeviceSessions {
  deviceSessionRepository: any;

  constructor(deps: any) {
    this.deviceSessionRepository = deps.deviceSessionRepository;
  }

  async execute(params: any): Promise<any[]> {
    const { tenantId, userId, status } = params;
    if (userId) {
      return this.deviceSessionRepository.listByUser(tenantId, userId, status);
    }
    return this.deviceSessionRepository.listByTenant(tenantId, { status });
  }
}
