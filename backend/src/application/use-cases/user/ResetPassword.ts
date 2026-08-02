import bcrypt from 'bcryptjs';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class ResetPassword {
  userRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.userRepository = deps.userRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, userId, newPassword, requesterId, actorName, actorUsername } = params;

    const user = await this.userRepository.findById(tenantId, userId);
    if (!user) throw new NotFoundError('User');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(tenantId, userId, passwordHash);

    this.auditService.log({
      tenantId, userId: requesterId, actorName, actorUsername,
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      module: MODULES.USER, entityId: userId,
      after: { targetUsername: user.username, targetName: user.name, targetRole: user.role },
    });

    return { message: 'Password reset successfully' };
  }
}
