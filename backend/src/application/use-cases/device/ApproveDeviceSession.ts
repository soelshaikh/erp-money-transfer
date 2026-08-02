import mongoose from 'mongoose';
import { DEVICE_STATUS, AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class ApproveDeviceSession {
  deviceSessionRepository: any;
  userRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.deviceSessionRepository = deps.deviceSessionRepository;
    this.userRepository = deps.userRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, sessionId, approverId, actorName, actorUsername } = params;

    const session = await this.deviceSessionRepository.findById(sessionId);
    if (!session || session.tenantId.toString() !== tenantId) {
      throw new NotFoundError('Device session');
    }

    // Suspend all other approved sessions for this user
    await this.deviceSessionRepository.suspendAllExcept(
      tenantId,
      session.userId.toString(),
      sessionId
    );

    // Approve this session
    const updated = await this.deviceSessionRepository.update(sessionId, {
      status:     DEVICE_STATUS.APPROVED,
      approvedBy: new mongoose.Types.ObjectId(approverId),
      approvedAt: new Date(),
    });

    // Wipe refresh token — forces all other live sessions to re-authenticate
    // When they hit /auth/refresh next time it will fail → they re-login → see suspended screen
    await this.userRepository.update(
      tenantId,
      session.userId.toString(),
      { refreshTokenHash: null }
    );

    this.auditService.log({
      tenantId, userId: approverId, actorName, actorUsername,
      action: AUDIT_ACTIONS.DEVICE_APPROVE,
      module: MODULES.DEVICE,
      entityId: sessionId,
      after: { deviceName: session.deviceName, userId: session.userId },
    });

    return updated;
  }
}
