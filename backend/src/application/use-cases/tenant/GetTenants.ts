export default class GetTenants {
  tenantRepository: any;

  constructor(deps: any) {
    this.tenantRepository = deps.tenantRepository;
  }

  async execute(filters: any): Promise<any> {
    return this.tenantRepository.findAll(filters);
  }
}
