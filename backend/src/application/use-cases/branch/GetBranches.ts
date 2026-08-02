export default class GetBranches {
  branchRepository: any;
  tenantRepository: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
    this.tenantRepository = deps.tenantRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, filters } = params;
    const [result, tenant, branchCount] = await Promise.all([
      this.branchRepository.findAll(tenantId, filters),
      this.tenantRepository.findById(tenantId),
      this.branchRepository.countNonHeadOffice(tenantId),
    ]);
    return {
      ...result,
      branchLimit: tenant?.branchLimit ?? null,
      branchCount,
    };
  }
}
