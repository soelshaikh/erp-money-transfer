import { NotFoundError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class DeleteUser {
  private userRepository: any;
  private notificationService: any;
  private auditService: any;

  constructor({ userRepository, notificationService, auditService }: any) {
    this.userRepository = userRepository;
    this.notificationService = notificationService;
    this.auditService = auditService;
  }

  async execute({ tenantId, userId, deletedBy, actorName, actorUsername }: any): Promise<any> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('User');

    await this.userRepository.update(tenantId, userId, { status: 'inactive' });

    // Force-logout this user immediately
    await this.notificationService.forceLogoutUser(tenantId, userId);

    await this.auditService.log({
      tenantId,
      userId: deletedBy,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.DELETE,
      module: MODULES.USER,
      entityId: userId,
      before: { username: user.username, name: user.name, role: user.role, status: 'active' },
      after: { status: 'inactive' },
    });

    return { success: true };
  }
}
