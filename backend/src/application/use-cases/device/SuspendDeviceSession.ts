import mongoose from 'mongoose';
import { DEVICE_STATUS, AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { NotFoundError, ForbiddenError } from '../../../domain/errors';

export default class SuspendDeviceSession {
  deviceSessionRepository: any;
  userRepository: any;
  auditService: any;
  notificationService: any;

  constructor(deps: any) {
    this.deviceSessionRepository = deps.deviceSessionRepository;
    this.userRepository = deps.userRepository;
    this.auditService = deps.auditService;
    this.notificationService = deps.notificationService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, sessionId, suspenderId, actorName, actorUsername, ownerId } = params;

    const session = await this.deviceSessionRepository.findById(sessionId);
    if (!session || session.tenantId.toString() !== tenantId) {
      throw new NotFoundError('Device session');
    }

    // Non-admin callers may only sign out their own session
    if (ownerId) {
      const sessionUserId = session.userId?._id?.toString() || session.userId?.toString();
      if (sessionUserId !== ownerId) {
        throw new ForbiddenError('You can only sign out your own sessions');
      }
    }

    const updated = await this.deviceSessionRepository.update(sessionId, {
      status:      DEVICE_STATUS.SUSPENDED,
      suspendedBy: new mongoose.Types.ObjectId(suspenderId),
      suspendedAt: new Date(),
    });

    const userId = session.userId?._id?.toString() || session.userId?.toString();

    // Wipe refresh token and immediately force-logout via socket
    if (session.status === DEVICE_STATUS.APPROVED) {
      await this.userRepository.update(tenantId, userId, { refreshTokenHash: null });
      this.notificationService.forceLogoutUser(tenantId, userId).catch(() => {});
    }

    // Admin-initiated suspend: remove device from whitelist so next login requires re-approval
    // Self sign-out (ownerId set) does NOT clear the whitelist — user should be able to log back in
    if (!ownerId) {
      await this.userRepository.removeDevice(tenantId, userId, session.deviceId).catch(() => {});
    }

    this.auditService.log({
      tenantId, userId: suspenderId, actorName, actorUsername,
      action: AUDIT_ACTIONS.DEVICE_SUSPEND,
      module: MODULES.DEVICE,
      entityId: sessionId,
      after: { deviceName: session.deviceName, userId: session.userId },
    });

    return updated;
  }
}
