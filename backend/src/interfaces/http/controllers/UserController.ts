import { NotFoundError, ForbiddenError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class UserController {
  private createUser: any;
  private updateUser: any;
  private getUsers: any;
  private resetPassword: any;
  private userRepository: any;
  private deviceSessionRepository: any;
  private suspendUser_uc: any;
  private getUserActiveTransactions_uc: any;
  private notificationService: any;
  private auditService: any;

  constructor({ createUser, updateUser, getUsers, resetPassword, userRepository, deviceSessionRepository, suspendUser, getUserActiveTransactions, notificationService, auditService }: any) {
    this.createUser = createUser;
    this.updateUser = updateUser;
    this.getUsers = getUsers;
    this.resetPassword = resetPassword;
    this.userRepository = userRepository;
    this.deviceSessionRepository = deviceSessionRepository;
    this.suspendUser_uc = suspendUser;
    this.getUserActiveTransactions_uc = getUserActiveTransactions;
    this.notificationService = notificationService;
    this.auditService = auditService;
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.list = this.list.bind(this);
    this.getOne = this.getOne.bind(this);
    this.resetPwd = this.resetPwd.bind(this);
    this.suspendUser = this.suspendUser.bind(this);
    this.getActiveTransactions = this.getActiveTransactions.bind(this);
    this.listDevices = this.listDevices.bind(this);
    this.addDevice = this.addDevice.bind(this);
    this.removeDevice = this.removeDevice.bind(this);
    this.toggleStatus = this.toggleStatus.bind(this);
  }

  async create(req: any, res: any) {
    const user = await this.createUser.execute({
      ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id,
      actorName: req.user.name, actorUsername: req.user.username,
    });
    res.status(201).json({ success: true, data: user });
  }

  async update(req: any, res: any) {
    const user = await this.updateUser.execute({
      tenantId: req.user.tenantId, userId: req.params.id, updates: req.body, requesterId: req.user.id,
      actorName: req.user.name, actorUsername: req.user.username,
    });
    res.json({ success: true, data: user });
  }

  async list(req: any, res: any) {
    const { role, branchId, status, page, limit } = req.query;
    const result = await this.getUsers.execute({
      tenantId: req.user.tenantId,
      filters: { role, branchId, status, page: Number(page) || 1, limit: Number(limit) || 20 },
    });
    res.json({ success: true, data: result });
  }

  async getOne(req: any, res: any) {
    const user = await this.userRepository.findById(req.user.tenantId, req.params.id);
    if (!user) throw new NotFoundError('User');
    res.json({ success: true, data: user });
  }

  async resetPwd(req: any, res: any) {
    const result = await this.resetPassword.execute({
      tenantId: req.user.tenantId, userId: req.params.id, newPassword: req.body.newPassword, requesterId: req.user.id,
      actorName: req.user.name, actorUsername: req.user.username,
    });
    res.json({ success: true, data: result });
  }

  async getActiveTransactions(req: any, res: any): Promise<void> {
    const result = await this.getUserActiveTransactions_uc.execute({
      tenantId: req.user.tenantId,
      userId: req.params.id,
    });
    res.json({ success: true, data: result });
  }

  async suspendUser(req: any, res: any): Promise<void> {
    if (req.params.id === req.user.id) throw new ForbiddenError('You cannot suspend your own account');
    const result = await this.suspendUser_uc.execute({
      tenantId: req.user.tenantId,
      userId: req.params.id,
      suspendedBy: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: result });
  }

  async toggleStatus(req: any, res: any): Promise<void> {
    if (req.params.id === req.user.id) throw new ForbiddenError('You cannot disable your own account');
    const user = await this.userRepository.findById(req.user.tenantId, req.params.id);
    if (!user) throw new NotFoundError('User');
    if (user.status === 'suspended') throw new ForbiddenError('This user is permanently suspended and cannot be toggled.');
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    await this.userRepository.update(req.user.tenantId, req.params.id, { status: newStatus });
    if (newStatus === 'disabled') {
      // Suspend all active sessions — allowedDevices kept intact so re-enabling restores access
      await this.deviceSessionRepository.suspendAllByUser(req.user.tenantId, req.params.id);
      this.notificationService.forceLogoutUser(req.user.tenantId, req.params.id).catch(() => {});
    }
    this.auditService.log({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
      action: AUDIT_ACTIONS.UPDATE,
      module: MODULES.USER,
      entityId: req.params.id,
      before: { username: user.username, name: user.name, status: user.status },
      after: { username: user.username, name: user.name, status: newStatus },
    });
    res.json({ success: true, data: { status: newStatus } });
  }

  async listDevices(req: any, res: any): Promise<void> {
    const devices = await this.userRepository.getDevices(req.user.tenantId, req.params.id);
    res.json({ success: true, data: devices });
  }

  async addDevice(req: any, res: any): Promise<void> {
    const { tenantId } = req.user;
    const userId = req.params.id;
    await this.userRepository.addDevice(tenantId, userId, {
      deviceId: req.body.deviceId,
      deviceName: req.body.deviceName || 'Unknown Device',
      registeredAt: new Date(),
    });
    this.auditService.log({
      tenantId, userId: req.user.id, actorName: req.user.name, actorUsername: req.user.username,
      action: AUDIT_ACTIONS.CREATE, module: MODULES.DEVICE,
      entityId: userId, after: { deviceId: req.body.deviceId, action: 'device_added' },
    });
    res.json({ success: true, data: { message: 'Device added' } });
  }

  async removeDevice(req: any, res: any): Promise<void> {
    const { tenantId } = req.user;
    const userId = req.params.id;
    const { deviceId } = req.params;
    await this.userRepository.removeDevice(tenantId, userId, deviceId);
    // Suspend any live session for this device and force-logout the user
    await this.deviceSessionRepository.suspendByDeviceId(tenantId, userId, deviceId);
    this.notificationService.forceLogoutUser(tenantId, userId).catch(() => {});
    this.auditService.log({
      tenantId, userId: req.user.id, actorName: req.user.name, actorUsername: req.user.username,
      action: AUDIT_ACTIONS.DELETE, module: MODULES.DEVICE,
      entityId: userId, after: { deviceId, action: 'device_removed' },
    });
    res.json({ success: true, data: { message: 'Device removed' } });
  }
}
