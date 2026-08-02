import mongoose from 'mongoose';
import { AUDIT_ACTIONS, MODULES, DEVICE_STATUS } from '../../../config/constants';

export default class SuspendAllSessions {
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

  async execute({ tenantId, suspenderId, actorName, actorUsername }: any): Promise<{ suspended: number }> {
    const sessions = await this.deviceSessionRepository.listByTenant(tenantId, { status: DEVICE_STATUS.APPROVED });

    if (sessions.length === 0) return { suspended: 0 };

    const affectedUserIds = new Set<string>();

    await Promise.all(
      sessions.map(async (session: any) => {
        // userId may be a populated object or raw ObjectId
        const userId = session.userId?._id?.toString() || session.userId?.toString();
        if (userId) affectedUserIds.add(userId);
        await Promise.all([
          this.deviceSessionRepository.update(session._id.toString(), {
            status: DEVICE_STATUS.SUSPENDED,
            suspendedBy: new mongoose.Types.ObjectId(suspenderId),
            suspendedAt: new Date(),
          }),
          userId
            ? this.userRepository.update(tenantId, userId, { refreshTokenHash: null })
            : Promise.resolve(),
        ]);
      })
    );

    // Force-logout all affected users via socket (fire-and-forget)
    affectedUserIds.forEach((uid) => {
      this.notificationService.forceLogoutUser(tenantId, uid).catch(() => {});
    });

    this.auditService.log({
      tenantId,
      userId: suspenderId,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.DEVICE_SUSPEND,
      module: MODULES.DEVICE,
      after: { count: sessions.length, action: 'suspend_all' },
    });

    return { suspended: sessions.length };
  }
}
