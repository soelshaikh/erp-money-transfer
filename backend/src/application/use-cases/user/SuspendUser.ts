import { NotFoundError, ForbiddenError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class SuspendUser {
  private userRepository: any;
  private deviceSessionRepository: any;
  private notificationService: any;
  private auditService: any;

  constructor({ userRepository, deviceSessionRepository, notificationService, auditService }: any) {
    this.userRepository = userRepository;
    this.deviceSessionRepository = deviceSessionRepository;
    this.notificationService = notificationService;
    this.auditService = auditService;
  }

  async execute({ tenantId, userId, suspendedBy, actorName, actorUsername }: any): Promise<any> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('User');
    if (user.status === 'suspended') throw new ForbiddenError('User is already suspended');

    await this.userRepository.update(tenantId, userId, { status: 'suspended' });

    // Suspend all device sessions + clear whitelist so re-enabling requires full re-approval
    await Promise.all([
      this.deviceSessionRepository.suspendAllByUser(tenantId, userId),
      this.userRepository.clearAllowedDevices(tenantId, userId),
    ]);

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
