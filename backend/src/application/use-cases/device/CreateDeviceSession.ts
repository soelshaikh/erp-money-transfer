import { DEVICE_STATUS, NOTIFICATION_TYPE, ROLES, AUDIT_ACTIONS, MODULES } from '../../../config/constants';

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export default class CreateDeviceSession {
  deviceSessionRepository: any;
  userRepository: any;
  notificationService: any;
  auditService: any;

  constructor(deps: any) {
    this.deviceSessionRepository = deps.deviceSessionRepository;
    this.userRepository = deps.userRepository || null;
    this.notificationService = deps.notificationService || null;
    this.auditService = deps.auditService || null;
  }

  async execute(params: any): Promise<{ deviceStatus: string }> {
    const { tenantId, userId, deviceId, deviceName, platform, ip, userAgent, userName, autoApprove } = params;

    const existing = await this.deviceSessionRepository.findOne(tenantId, userId, deviceId);

    if (!existing) {
      const initialStatus = autoApprove ? DEVICE_STATUS.APPROVED : DEVICE_STATUS.PENDING;
      const created = await this.deviceSessionRepository.create({
        tenantId, userId, deviceId,
        deviceName: deviceName || 'Unknown Device',
        platform: platform || 'unknown',
        ip, userAgent,
        status: initialStatus,
        attemptCount: 0,
        approvedAt: autoApprove ? new Date() : null,
      });
      if (autoApprove) {
        // Suspend other approved sessions and wipe refresh token — consistent with manual approval
        await this.deviceSessionRepository.suspendAllExcept(tenantId, userId.toString(), created._id.toString());
        if (this.userRepository) {
          await this.userRepository.update(tenantId, userId.toString(), { refreshTokenHash: null });
        }
        this._auditAutoApprove(tenantId, userId, deviceName, created._id.toString());
      } else {
        this._notify(tenantId, userId, deviceName, userName);
      }
      return { deviceStatus: initialStatus };
    }

    // For auto-approved tenants: always keep session approved and refresh IP.
    // Do NOT call suspendAllExcept here — that would suspend every other whitelisted
    // device on every re-login, creating an endless suspension cycle. suspendAllExcept
    // is only appropriate when a brand-new device is first approved (below) or when
    // an admin explicitly approves one device from the DeviceApprovals screen.
    if (autoApprove) {
      await this.deviceSessionRepository.update(existing._id.toString(), {
        status: DEVICE_STATUS.APPROVED,
        ip, userAgent,
        approvedAt: existing.approvedAt || new Date(),
      });
      this._auditAutoApprove(tenantId, userId, deviceName, existing._id.toString());
      return { deviceStatus: DEVICE_STATUS.APPROVED };
    }

    if (existing.status === DEVICE_STATUS.PENDING)   return { deviceStatus: DEVICE_STATUS.PENDING };
    if (existing.status === DEVICE_STATUS.APPROVED)  return { deviceStatus: DEVICE_STATUS.APPROVED };
    if (existing.status === DEVICE_STATUS.SUSPENDED) return { deviceStatus: DEVICE_STATUS.SUSPENDED };

    // REJECTED — handle re-submission with rate limit
    if (existing.status === DEVICE_STATUS.REJECTED) {
      const now = new Date();
      const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MS);
      const lastAttempt = existing.lastAttemptAt ? new Date(existing.lastAttemptAt) : null;
      const currentCount = (lastAttempt && lastAttempt > windowStart) ? existing.attemptCount : 0;

      if (currentCount >= MAX_ATTEMPTS) {
        return { deviceStatus: 'blocked' };
      }

      await this.deviceSessionRepository.update(existing._id.toString(), {
        status: DEVICE_STATUS.PENDING,
        attemptCount: currentCount + 1,
        lastAttemptAt: now,
        ip,
        userAgent,
      });
      this._notify(tenantId, userId, deviceName, userName);
      return { deviceStatus: DEVICE_STATUS.PENDING };
    }

    return { deviceStatus: existing.status };
  }

  _notify(tenantId: any, userId: any, deviceName: string, userName: string) {
    if (!this.notificationService) return;
    this.notificationService.notifyRole(tenantId, ROLES.HEAD_OFFICE, {
      type: NOTIFICATION_TYPE.DEVICE_PENDING_APPROVAL,
      title: 'Device Approval Required',
      body: `${userName} is requesting access from: ${deviceName || 'Unknown Device'}`,
      data: { userId: String(userId) },
    }).catch(() => {});
  }

  _auditAutoApprove(tenantId: any, userId: any, deviceName: string, sessionId: string) {
    if (!this.auditService) return;
    this.auditService.log({
      tenantId,
      userId,
      action: AUDIT_ACTIONS.DEVICE_APPROVE,
      module: MODULES.DEVICE,
      entityId: sessionId,
      after: { deviceName, autoApproved: true },
    });
  }
}
