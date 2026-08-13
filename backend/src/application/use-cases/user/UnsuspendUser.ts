import { NotFoundError, ForbiddenError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class UnsuspendUser {
  private userRepository: any;
  private auditService: any;

  constructor({ userRepository, auditService }: any) {
    this.userRepository = userRepository;
    this.auditService = auditService;
  }

  async execute({ tenantId, userId, unsuspendedBy, actorName, actorUsername }: any): Promise<any> {
    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('User');
    if (user.status !== 'suspended') throw new ForbiddenError('User is not suspended');

    await this.userRepository.update(tenantId, userId, { status: 'active' });

    await this.auditService.log({
      tenantId,
      userId: unsuspendedBy,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.UNSUSPEND,
      module: MODULES.USER,
      entityId: userId,
      before: { username: user.username, name: user.name, status: 'suspended' },
      after:  { username: user.username, name: user.name, status: 'active' },
    });

    return { success: true };
  }
}
