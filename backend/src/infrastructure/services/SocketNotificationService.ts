import INotificationService from '../../application/ports/INotificationService';
import NotificationModel from '../db/models/Notification.model';
import UserModel from '../db/models/User.model';
import logger from '../../config/logger';

/**
 * Real-time notifications via Socket.IO.
 * Socket rooms follow the pattern: `${tenantId}:role:${role}` and `${tenantId}:user:${userId}`.
 * The socket server must join users to their rooms on connection (handled in socket.js).
 */
export default class SocketNotificationService extends INotificationService {
  private io: any;

  constructor(io: any) {
    super();
    this.io = io;
  }

  async notifyRole(tenantId: any, role: any, payload: any) {
    this.io.to(`${tenantId}:role:${role}`).emit('notification', payload);
    logger.debug({ tenantId, role, type: payload.type }, 'Notification sent to role room');
    // Persist per-user so notification history works
    UserModel.find({ tenantId, role, status: 'active' }, '_id').lean()
      .then((users: any[]) => Promise.all(users.map((u: any) => this._persist(tenantId, u._id, payload, null))))
      .catch((err: any) => logger.error({ err }, 'Failed to persist role notifications'));
  }

  async notifyUser(tenantId: any, userId: any, payload: any) {
    const notification = await this._persist(tenantId, userId, payload, null);
    this.io.to(`${tenantId}:user:${userId}`).emit('notification', {
      ...payload,
      notificationId: notification?._id,
    });
  }

  async notifyBranch(tenantId: any, branchId: any, payload: any) {
    this.io.to(`${tenantId}:branch:${branchId}`).emit('notification', payload);
    // Persist per-user so notification history works
    UserModel.find({ tenantId, branchId, status: 'active' }, '_id').lean()
      .then((users: any[]) => Promise.all(users.map((u: any) => this._persist(tenantId, u._id, payload, null))))
      .catch((err: any) => logger.error({ err }, 'Failed to persist branch notifications'));
  }

  async forceLogoutUser(tenantId: any, userId: any): Promise<void> {
    this.io.to(`${tenantId}:user:${userId}`).emit('force_logout');
  }

  async forceLogoutBranch(tenantId: any, branchId: any): Promise<void> {
    this.io.to(`${tenantId}:branch:${branchId}`).emit('force_logout');
  }

  async forceLogoutTenant(tenantId: any): Promise<void> {
    this.io.to(`tenant:${tenantId}`).emit('force_logout');
  }

  async _persist(tenantId: any, userId: any, payload: any, role: any) {
    if (!userId) return null; // role-wide notifications are not persisted per-user here
    return NotificationModel.create({
      tenantId,
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data || null,
    });
  }
}
