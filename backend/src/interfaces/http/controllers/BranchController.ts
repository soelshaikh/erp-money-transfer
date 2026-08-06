import { NotFoundError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class BranchController {
  private createBranch: any;
  private updateBranch: any;
  private getBranches: any;
  private branchRepository: any;
  private deleteBranch_uc: any;
  private getBranchLedger: any;
  private getBranchDailyBalances: any;
  private notificationService: any;
  private auditService: any;

  constructor({ createBranch, updateBranch, getBranches, branchRepository, deleteBranch, getBranchLedger, getBranchDailyBalances, notificationService, auditService }: any) {
    this.createBranch = createBranch;
    this.updateBranch = updateBranch;
    this.getBranches = getBranches;
    this.branchRepository = branchRepository;
    this.deleteBranch_uc = deleteBranch;
    this.getBranchLedger = getBranchLedger;
    this.getBranchDailyBalances = getBranchDailyBalances;
    this.notificationService = notificationService;
    this.auditService = auditService;
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.list = this.list.bind(this);
    this.getOne = this.getOne.bind(this);
    this.listActive = this.listActive.bind(this);
    this.deleteBranch = this.deleteBranch.bind(this);
    this.ledger = this.ledger.bind(this);
    this.myLedger = this.myLedger.bind(this);
    this.dailyBalances = this.dailyBalances.bind(this);
    this.balanceSummary = this.balanceSummary.bind(this);
    this.toggleStatus = this.toggleStatus.bind(this);
  }

  async create(req: any, res: any) {
    const branch = await this.createBranch.execute({
      ...req.body, tenantId: req.user.tenantId, createdBy: req.user.id,
      actorName: req.user.name, actorUsername: req.user.username,
    });
    res.status(201).json({ success: true, data: branch });
  }

  async update(req: any, res: any) {
    const branch = await this.updateBranch.execute({
      tenantId: req.user.tenantId, branchId: req.params.id, updates: req.body, userId: req.user.id,
      actorName: req.user.name, actorUsername: req.user.username,
    });
    res.json({ success: true, data: branch });
  }

  async list(req: any, res: any) {
    const { type, status, page, limit } = req.query;
    const result = await this.getBranches.execute({
      tenantId: req.user.tenantId,
      filters: { type, status, page: Number(page) || 1, limit: Number(limit) || 20 },
    });
    res.json({ success: true, data: result });
  }

  async getOne(req: any, res: any) {
    const branch = await this.branchRepository.findById(req.user.tenantId, req.params.id);
    if (!branch) throw new NotFoundError('Branch');
    res.json({ success: true, data: branch });
  }

  async listActive(req: any, res: any) {
    const branches = await this.branchRepository.findAllActive(req.user.tenantId);
    res.json({ success: true, data: branches });
  }

  async deleteBranch(req: any, res: any): Promise<void> {
    const result = await this.deleteBranch_uc.execute({
      tenantId: req.user.tenantId,
      branchId: req.params.id,
      deletedBy: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: result });
  }

  async toggleStatus(req: any, res: any) {
    const branch = await this.branchRepository.findById(req.user.tenantId, req.params.id);
    if (!branch) throw new NotFoundError('Branch');
    const newStatus = branch.status === 'active' ? 'inactive' : 'active';
    await this.branchRepository.update(req.user.tenantId, req.params.id, { status: newStatus });
    if (newStatus === 'inactive') {
      this.notificationService.forceLogoutBranch(req.user.tenantId, req.params.id).catch(() => {});
    }
    this.auditService.log({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
      action: AUDIT_ACTIONS.UPDATE,
      module: MODULES.BRANCH,
      entityId: req.params.id,
      before: { name: branch.name, status: branch.status },
      after: { name: branch.name, status: newStatus },
    });
    res.json({ success: true, data: { status: newStatus } });
  }

  async ledger(req: any, res: any) {
    const { page, limit, fromDate, toDate } = req.query;
    const result = await this.getBranchLedger.execute({
      tenantId: req.user.tenantId,
      branchId: req.params.id,
      filters: {
        page: Number(page) || 1,
        limit: Number(limit) || 30,
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
    });
    res.json({ success: true, data: result });
  }

  async myLedger(req: any, res: any) {
    const { page, limit, fromDate, toDate } = req.query;
    const result = await this.getBranchLedger.execute({
      tenantId: req.user.tenantId,
      branchId: req.user.branchId,
      filters: {
        page: Number(page) || 1,
        limit: Number(limit) || 30,
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
    });
    res.json({ success: true, data: result });
  }

  async dailyBalances(req: any, res: any) {
    const { page, limit, fromDate, toDate } = req.query;
    const result = await this.getBranchDailyBalances.execute({
      tenantId: req.user.tenantId,
      branchId: req.params.id,
      filters: {
        page: Number(page) || 1,
        limit: Number(limit) || 30,
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
    });
    res.json({ success: true, data: result });
  }

  async balanceSummary(req: any, res: any) {
    const branches = await this.branchRepository.findAllActive(req.user.tenantId);

    const mapped = branches.map((b: any) => {
      const actualBalance = b.balance ?? 0;
      const committedPayout = b.committedPayout ?? 0;
      const pendingPayout = b.pendingPayout ?? 0;
      const payoutCompleted = b.payoutCompleted ?? 0;
      const commissionPayable = b.commissionPayable ?? 0;
      const commissionReceivable = b.commissionReceivable ?? 0;
      return {
        id: b._id,
        name: b.name,
        code: b.code,
        type: b.type,
        actualBalance,
        committedPayout,
        pendingPayout,
        payoutCompleted,
        commissionPayable,
        commissionReceivable,
        effectiveBalance: actualBalance - committedPayout - pendingPayout + payoutCompleted - commissionPayable + commissionReceivable,
      };
    });

    const totals = mapped.reduce(
      (acc: any, b: any) => ({
        actual: acc.actual + b.actualBalance,
        committed: acc.committed + b.committedPayout,
        pending: acc.pending + b.pendingPayout,
        commissionPayable: acc.commissionPayable + b.commissionPayable,
        commissionReceivable: acc.commissionReceivable + b.commissionReceivable,
        effective: acc.effective + b.effectiveBalance,
      }),
      { actual: 0, committed: 0, pending: 0, commissionPayable: 0, commissionReceivable: 0, effective: 0 },
    );

    res.json({ success: true, data: { branches: mapped, totals } });
  }
}
