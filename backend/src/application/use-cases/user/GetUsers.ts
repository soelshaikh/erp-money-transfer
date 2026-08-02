export default class GetUsers {
  userRepository: any;
  tenantRepository: any;

  constructor(deps: any) {
    this.userRepository = deps.userRepository;
    this.tenantRepository = deps.tenantRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, filters } = params;
    const [result, tenant, activeCount] = await Promise.all([
      this.userRepository.findAll(tenantId, filters),
      this.tenantRepository.findById(tenantId),
      this.userRepository.countActiveByTenant(tenantId),
    ]);
    return {
      ...result,
      staffLimit: tenant?.staffLimit ?? null,
      activeStaffCount: activeCount,
    };
  }
}
