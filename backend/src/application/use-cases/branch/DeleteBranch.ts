import { NotFoundError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class DeleteBranch {
  private branchRepository: any;
  private notificationService: any;
  private auditService: any;

  constructor({ branchRepository, notificationService, auditService }: any) {
    this.branchRepository = branchRepository;
    this.notificationService = notificationService;
    this.auditService = auditService;
  }

  async execute({ tenantId, branchId, deletedBy, actorName, actorUsername }: any): Promise<any> {
    const branch = await this.branchRepository.findById(tenantId, branchId);
    if (!branch) throw new NotFoundError('Branch');

    await this.branchRepository.update(tenantId, branchId, { status: 'inactive' });

    // Force-logout all staff connected to this branch immediately
    await this.notificationService.forceLogoutBranch(tenantId, branchId);

    await this.auditService.log({
      tenantId,
      userId: deletedBy,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.DELETE,
      module: MODULES.BRANCH,
      entityId: branchId,
      before: { name: branch.name, code: branch.code, type: branch.type, status: 'active' },
      after: { status: 'inactive' },
    });

    return { success: true };
  }
}
