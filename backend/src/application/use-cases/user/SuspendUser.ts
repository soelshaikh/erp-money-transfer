import { NotFoundError, ForbiddenError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class SuspendUser {
  private userRepository: any;
  private notificationService: any;
  private auditService: any;

  constructor({ userRepository, notificationService, auditService }: any) {
    this.userRepository = userRepository;
    this.notificationService = notificationService;
    this.auditService = auditService;
  }

  async execute({ tenantId, userId, suspendedBy, actorName, actorUsername }: any): Promise<any> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('User');
    if (user.status === 'suspended') throw new ForbiddenError('User is already suspended');

    await this.userRepository.update(tenantId, userId, { status: 'suspended' });
    this.notificationService.forceLogoutUser(tenantId, userId).catch(() => {});

    await this.auditService.log({
      tenantId,
      userId: suspendedBy,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.SUSPEND,
      module: MODULES.USER,
      entityId: userId,
      before: { username: user.username, name: user.name, status: user.status },
      after: { username: user.username, name: user.name, status: 'suspended' },
    });

    return { success: true };
  }
}
