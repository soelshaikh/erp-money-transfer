import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class UpdateUser {
  userRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.userRepository = deps.userRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, userId, updates, requesterId, actorName, actorUsername } = params;

    const before = await this.userRepository.findById(tenantId, userId);
    if (!before) throw new NotFoundError('User');

    // Disallow changing sensitive fields via this use-case
    delete updates.passwordHash;
    delete updates.username;
    delete updates.tenantId;
    delete updates.role; // role changes require explicit separate flow

    const user = await this.userRepository.update(tenantId, userId, updates);

    const { passwordHash: _ph, otpHash: _oh, ...beforeSafe } = before;

    this.auditService.log({
      tenantId, userId: requesterId, actorName, actorUsername,
      action: AUDIT_ACTIONS.UPDATE,
      module: MODULES.USER, entityId: userId,
      before: beforeSafe, after: updates,
    });

    return user;
  }
}
