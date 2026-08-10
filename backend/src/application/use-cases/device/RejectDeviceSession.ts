import mongoose from 'mongoose';
import { DEVICE_STATUS, AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import { NotFoundError } from '../../../domain/errors';

export default class RejectDeviceSession {
  deviceSessionRepository: any;
  userRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.deviceSessionRepository = deps.deviceSessionRepository;
    this.userRepository = deps.userRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, sessionId, rejectorId, actorName, actorUsername } = params;

    const session = await this.deviceSessionRepository.findById(sessionId);
    if (!session || session.tenantId.toString() !== tenantId) {
      throw new NotFoundError('Device session');
    }

    const updated = await this.deviceSessionRepository.update(sessionId, {
      status:     DEVICE_STATUS.REJECTED,
      rejectedBy: new mongoose.Types.ObjectId(rejectorId),
      rejectedAt: new Date(),
    });

    // Remove from whitelist so next login from this device goes through pending again
    await this.userRepository.removeDevice(tenantId, session.userId.toString(), session.deviceId).catch(() => {});

    this.auditService.log({
      tenantId, userId: rejectorId, actorName, actorUsername,
      action: AUDIT_ACTIONS.DEVICE_REJECT,
      module: MODULES.DEVICE,
      entityId: sessionId,
      after: { deviceName: session.deviceName, userId: session.userId },
    });

    return updated;
  }
}
