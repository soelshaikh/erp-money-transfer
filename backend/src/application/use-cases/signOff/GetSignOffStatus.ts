import { todayIST } from '../../../utils/dateIST';

export default class GetSignOffStatus {
  userSignOffRepository: any;
  tenantRepository: any;

  constructor(deps: any) {
    this.userSignOffRepository = deps.userSignOffRepository;
    this.tenantRepository = deps.tenantRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantSlug, userId } = params;

    const tenant = await this.tenantRepository.findBySlug(tenantSlug);
    if (!tenant || tenant.status !== 'active') {
      return { signedOff: false, reLoginEnabled: false };
    }

    const date = todayIST();
    const record = await this.userSignOffRepository.findByUserAndDate(tenant._id, userId, date);

    if (!record) return { signedOff: false, reLoginEnabled: false };

    return {
      signedOff: true,
      reLoginEnabled: record.reLoginEnabled === true,
    };
  }
}
