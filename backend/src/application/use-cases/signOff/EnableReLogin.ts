import { NotFoundError } from '../../../domain/errors';

export default class EnableReLogin {
  userSignOffRepository: any;

  constructor(deps: any) {
    this.userSignOffRepository = deps.userSignOffRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, signOffId, enabledBy } = params;

    const record = await this.userSignOffRepository.enableReLogin(tenantId, signOffId, enabledBy);
    if (!record) throw new NotFoundError('SignOff record');

    return record;
  }
}
