import { todayIST } from '../../../utils/dateIST';

export default class GetDaySignOffs {
  userSignOffRepository: any;

  constructor(deps: any) {
    this.userSignOffRepository = deps.userSignOffRepository;
  }

  async execute(params: any): Promise<any[]> {
    const { tenantId, date } = params;
    const targetDate = date || todayIST();
    return this.userSignOffRepository.findByDate(tenantId, targetDate);
  }
}
