import { todayIST } from '../../../utils/dateIST';
import { NotFoundError } from '../../../domain/errors';

export default class SignOffUser {
  userSignOffRepository: any;
  userRepository: any;

  constructor(deps: any) {
    this.userSignOffRepository = deps.userSignOffRepository;
    this.userRepository = deps.userRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, userId } = params;

    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('User');

    const date = todayIST();
    const record = await this.userSignOffRepository.upsert({
      tenantId,
      userId,
      branchId: user.branchId ?? null,
      date,
      signedOffAt: new Date(),
    });

    return { date, signedOffAt: record.signedOffAt };
  }
}
