import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class UpdateBranch {
  branchRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, branchId, updates, userId, actorName, actorUsername } = params;

    const before = await this.branchRepository.findById(tenantId, branchId);
    if (!before) throw new NotFoundError('Branch');

    // Disallow code updates — token numbers depend on it
    delete updates.code;
    delete updates.tenantId;

    const branch = await this.branchRepository.update(tenantId, branchId, updates);

    this.auditService.log({
      tenantId, userId, actorName, actorUsername,
      action: AUDIT_ACTIONS.UPDATE,
      module: MODULES.BRANCH, entityId: branchId, before, after: updates,
    });

    return branch;
  }
}
