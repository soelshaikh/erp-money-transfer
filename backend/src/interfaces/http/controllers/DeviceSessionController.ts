export default class DeviceSessionController {
  private listDeviceSessions: any;
  private approveDeviceSession: any;
  private rejectDeviceSession: any;
  private suspendDeviceSession: any;
  private suspendAllSessions: any;

  constructor(deps: any) {
    this.listDeviceSessions = deps.listDeviceSessions;
    this.approveDeviceSession = deps.approveDeviceSession;
    this.rejectDeviceSession = deps.rejectDeviceSession;
    this.suspendDeviceSession = deps.suspendDeviceSession;
    this.suspendAllSessions = deps.suspendAllSessions;

    this.list = this.list.bind(this);
    this.mine = this.mine.bind(this);
    this.listByUser = this.listByUser.bind(this);
    this.approve = this.approve.bind(this);
    this.reject = this.reject.bind(this);
    this.suspend = this.suspend.bind(this);
    this.suspendAll = this.suspendAll.bind(this);
  }

  async list(req: any, res: any) {
    const { status, userId } = req.query;
    const sessions = await this.listDeviceSessions.execute({
      tenantId: req.user.tenantId,
      userId: userId || undefined,
      status: status || undefined,
    });
    res.json({ success: true, data: sessions });
  }

  async mine(req: any, res: any) {
    const sessions = await this.listDeviceSessions.execute({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      status: 'approved',
    });
    res.json({ success: true, data: sessions });
  }

  async listByUser(req: any, res: any) {
    const sessions = await this.listDeviceSessions.execute({
      tenantId: req.user.tenantId,
      userId: req.params.userId,
    });
    res.json({ success: true, data: sessions });
  }

  async approve(req: any, res: any) {
    const updated = await this.approveDeviceSession.execute({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      approverId: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: updated });
  }

  async reject(req: any, res: any) {
    const updated = await this.rejectDeviceSession.execute({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      rejectorId: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: updated });
  }

  async suspend(req: any, res: any) {
    const { role, id: requesterId, tenantId, name, username } = req.user;
    const isAdmin = role === 'head_office' || role === 'super_admin';
    const updated = await this.suspendDeviceSession.execute({
      tenantId,
      sessionId: req.params.id,
      suspenderId: requesterId,
      actorName: name,
      actorUsername: username,
      // Non-admins may only sign out their own session
      ownerId: isAdmin ? undefined : requesterId,
    });
    res.json({ success: true, data: updated });
  }

  async suspendAll(req: any, res: any) {
    const result = await this.suspendAllSessions.execute({
      tenantId: req.user.tenantId,
      suspenderId: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: result });
  }
}
