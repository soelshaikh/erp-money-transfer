import AppInstallModel from '../../../infrastructure/db/models/AppInstall.model';
import env from '../../../config/env';
import { APP_ACCESS_STATUS } from '../../../config/constants';

export default class RequestAppAccess {
  constructor(_deps: any) {}

  async execute(params: any): Promise<{ status: string }> {
    const { secretCode, deviceId, deviceName, platform, ip, userAgent } = params;

    if (!deviceId) return { status: 'invalid' };

    // If no access code is configured in env, the gate is disabled — auto-approve all devices
    if (!env.APP_ACCESS_CODE) {
      return this._approveDevice({ deviceId, deviceName, platform, ip, userAgent });
    }

    // Code configured but doesn't match — treat same as rejected (reveal nothing)
    if (secretCode !== env.APP_ACCESS_CODE) {
      return { status: 'invalid' };
    }

    const existing = await AppInstallModel.findOne({ deviceId });

    if (existing) {
      // Rejected devices get same response as wrong code
      if ((existing as any).status === APP_ACCESS_STATUS.REJECTED) return { status: 'invalid' };
      // Pending devices with correct code → auto-approve now
      if ((existing as any).status === APP_ACCESS_STATUS.PENDING) {
        existing.status = APP_ACCESS_STATUS.APPROVED;
        existing.approvedAt = new Date();
        await existing.save();
        return { status: APP_ACCESS_STATUS.APPROVED };
      }
      return { status: (existing as any).status };
    }

    // New device with correct code → create as approved immediately
    return this._approveDevice({ deviceId, deviceName, platform, ip, userAgent });
  }

  private async _approveDevice({ deviceId, deviceName, platform, ip, userAgent }: any): Promise<{ status: string }> {
    await AppInstallModel.findOneAndUpdate(
      { deviceId },
      {
        $set: { status: APP_ACCESS_STATUS.APPROVED, approvedAt: new Date() },
        $setOnInsert: {
          deviceId,
          deviceName: deviceName || 'Unknown Device',
          platform: platform || 'unknown',
          ip: ip || null,
          userAgent: userAgent || null,
        },
      },
      { upsert: true, new: true },
    );
    return { status: APP_ACCESS_STATUS.APPROVED };
  }
}
