import { ROLES } from '../../../config/constants';
import { NotFoundError, ConflictError } from '../../../domain/errors';

export default class TenantController {
  private createTenant: any;
  private updateTenantStatus: any;
  private updateTenantBranchLimit: any;
  private updateTenantStaffLimit: any;
  private getTenants: any;
  private tenantRepository: any;
  private branchRepository: any;
  private userRepository: any;
  private createUser: any;
  private resetDevData: any;
  private resetPassword: any;

  constructor({ createTenant, updateTenantStatus, updateTenantBranchLimit, updateTenantStaffLimit, getTenants, tenantRepository, branchRepository, userRepository, createUser, resetDevData, resetPassword }: any) {
    this.createTenant = createTenant;
    this.updateTenantStatus = updateTenantStatus;
    this.updateTenantBranchLimit = updateTenantBranchLimit;
    this.updateTenantStaffLimit = updateTenantStaffLimit;
    this.getTenants = getTenants;
    this.tenantRepository = tenantRepository;
    this.branchRepository = branchRepository;
    this.userRepository = userRepository;
    this.createUser = createUser;
    this.resetDevData = resetDevData;
    this.resetPassword = resetPassword;
    this.create = this.create.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.updateBranchLimit = this.updateBranchLimit.bind(this);
    this.updateStaffLimit = this.updateStaffLimit.bind(this);
    this.updateCommission = this.updateCommission.bind(this);
    this.updateBusinessType = this.updateBusinessType.bind(this);
    this.updateCommissionSplit = this.updateCommissionSplit.bind(this);
    this.updateTransactionLimits = this.updateTransactionLimits.bind(this);
    this.list = this.list.bind(this);
    this.getOne = this.getOne.bind(this);
    this.createHeadOffice = this.createHeadOffice.bind(this);
    this.resetDev = this.resetDev.bind(this);
    this.listTenantBranches = this.listTenantBranches.bind(this);
    this.listTenantUsers = this.listTenantUsers.bind(this);
    this.listUserDevices = this.listUserDevices.bind(this);
    this.addUserDevice = this.addUserDevice.bind(this);
    this.removeUserDevice = this.removeUserDevice.bind(this);
    this.updateExportFormats = this.updateExportFormats.bind(this);
    this.updateCreditCommissionFlag = this.updateCreditCommissionFlag.bind(this);
    this.updateDeviceApproval = this.updateDeviceApproval.bind(this);
    this.resetHoPassword = this.resetHoPassword.bind(this);
  }

  async create(req: any, res: any) {
    const tenant = await this.createTenant.execute(req.body);
    res.status(201).json({ success: true, data: tenant });
  }

  async updateStatus(req: any, res: any) {
    const tenant = await this.updateTenantStatus.execute({ tenantId: req.params.id, status: req.body.status });
    res.json({ success: true, data: tenant });
  }

  async updateBranchLimit(req: any, res: any) {
    const tenant = await this.updateTenantBranchLimit.execute({ tenantId: req.params.id, branchLimit: req.body.branchLimit });
    res.json({ success: true, data: tenant });
  }

  async updateStaffLimit(req: any, res: any) {
    const tenant = await this.updateTenantStaffLimit.execute({ tenantId: req.params.id, staffLimit: req.body.staffLimit });
    res.json({ success: true, data: tenant });
  }

  async updateTransactionLimits(req: any, res: any) {
    const tenantDoc = await this.tenantRepository.findById(req.params.id);
    if (!tenantDoc) throw new NotFoundError('Tenant');
    const { maxAmountPerTransaction, dailyLimitPerBranch } = req.body;
    const update: any = {};
    if (maxAmountPerTransaction !== undefined) update['settings.transactionLimits.maxAmountPerTransaction'] = maxAmountPerTransaction;
    if (dailyLimitPerBranch !== undefined) update['settings.transactionLimits.dailyLimitPerBranch'] = dailyLimitPerBranch;
    await this.tenantRepository.update(req.params.id, update);
    res.json({ success: true });
  }

  async updateCommission(req: any, res: any) {
    const tenant = await this.tenantRepository.findById(req.params.id);
    if (!tenant) throw new NotFoundError('Tenant');
    await this.tenantRepository.update(req.params.id, { 'settings.commission': req.body.commission });
    res.json({ success: true });
  }

  async updateBusinessType(req: any, res: any) {
    const tenant = await this.tenantRepository.findById(req.params.id);
    if (!tenant) throw new NotFoundError('Tenant');
    await this.tenantRepository.update(req.params.id, { businessType: req.body.businessType });
    res.json({ success: true, data: { businessType: req.body.businessType } });
  }

  async updateCommissionSplit(req: any, res: any) {
    const tenant = await this.tenantRepository.findById(req.params.id);
    if (!tenant) throw new NotFoundError('Tenant');
    await this.tenantRepository.update(req.params.id, { 'settings.commissionSplit': req.body.commissionSplit });
    res.json({ success: true, data: { commissionSplit: req.body.commissionSplit } });
  }

  async list(req: any, res: any) {
    const { status, page, limit } = req.query;
    const result = await this.getTenants.execute({ status, page: Number(page) || 1, limit: Number(limit) || 20 });
    res.json({ success: true, data: result });
  }

  async getOne(req: any, res: any) {
    const tenant = await this.tenantRepository.findById(req.params.id);
    if (!tenant) throw new NotFoundError('Tenant');
    res.json({ success: true, data: tenant });
  }

  async resetDev(req: any, res: any) {
    const counts = await this.resetDevData.execute();
    res.json({ success: true, data: { deleted: counts } });
  }

  async createHeadOffice(req: any, res: any) {
    const tenant = await this.tenantRepository.findById(req.params.id);
    if (!tenant) throw new NotFoundError('Tenant');

    const existing = await this.userRepository.findAll(tenant._id.toString(), { role: ROLES.HEAD_OFFICE, limit: 1 });
    if (existing.total > 0) throw new ConflictError('A head office account already exists for this company');

    const user = await this.createUser.execute({
      tenantId: tenant._id.toString(),
      username: req.body.username,
      password: req.body.password,
      role: ROLES.HEAD_OFFICE,
      name: req.body.name,
      branchId: null,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: user });
  }

  async resetHoPassword(req: any, res: any) {
    const existing = await this.userRepository.findAll(req.params.id, { role: ROLES.HEAD_OFFICE, limit: 1 });
    if (existing.total === 0) throw new NotFoundError('Head office account');
    const hoUser = existing.data[0];
    await this.resetPassword.execute({
      tenantId: req.params.id,
      userId: hoUser._id.toString(),
      newPassword: req.body.newPassword,
      requesterId: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: { message: 'Password updated successfully' } });
  }

  async listTenantBranches(req: any, res: any) {
    const { page, limit } = req.query;
    const result = await this.branchRepository.findAll(req.params.id, {
      page: Number(page) || 1,
      limit: Number(limit) || 100,
    });
    res.json({ success: true, data: result });
  }

  async listTenantUsers(req: any, res: any) {
    const { role, page, limit } = req.query;
    const result = await this.userRepository.findAll(req.params.id, {
      role,
      page: Number(page) || 1,
      limit: Number(limit) || 100,
    });
    res.json({ success: true, data: result });
  }

  async listUserDevices(req: any, res: any) {
    const devices = await this.userRepository.getDevices(req.params.tenantId, req.params.userId);
    res.json({ success: true, data: devices });
  }

  async addUserDevice(req: any, res: any) {
    await this.userRepository.addDevice(req.params.tenantId, req.params.userId, {
      deviceId: req.body.deviceId,
      deviceName: req.body.deviceName || 'Unknown Device',
      registeredAt: new Date(),
    });
    res.json({ success: true, data: { message: 'Device added' } });
  }

  async removeUserDevice(req: any, res: any) {
    await this.userRepository.removeDevice(req.params.tenantId, req.params.userId, req.params.deviceId);
    res.json({ success: true, data: { message: 'Device removed' } });
  }

  async updateCreditCommissionFlag(req: any, res: any) {
    const tenantDoc = await this.tenantRepository.findById(req.params.id);
    if (!tenantDoc) throw new NotFoundError('Tenant');
    const { enabled } = req.body;
    await this.tenantRepository.update(req.params.id, { 'features.creditCommissionToSendingBranch': Boolean(enabled) });
    res.json({ success: true, data: { creditCommissionToSendingBranch: Boolean(enabled) } });
  }

  async updateDeviceApproval(req: any, res: any) {
    const tenantDoc = await this.tenantRepository.findById(req.params.id);
    if (!tenantDoc) throw new NotFoundError('Tenant');
    const { enabled } = req.body;
    await this.tenantRepository.update(req.params.id, { 'features.deviceApprovalRequired': Boolean(enabled) });
    res.json({ success: true, data: { deviceApprovalRequired: Boolean(enabled) } });
  }

  async updateExportFormats(req: any, res: any) {
    const tenantDoc = await this.tenantRepository.findById(req.params.id);
    if (!tenantDoc) throw new NotFoundError('Tenant');
    const { formats } = req.body;
    if (!Array.isArray(formats) || formats.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one format is required' });
    }
    const valid = ['csv', 'excel', 'pdf'];
    const sanitized = formats.filter((f: string) => valid.includes(f));
    if (sanitized.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid formats provided' });
    }
    await this.tenantRepository.update(req.params.id, { 'features.exportFormats': sanitized });
    res.json({ success: true });
  }
}
