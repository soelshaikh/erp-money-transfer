export default class PartnerTransferController {
  private createPartnerTransfer: any;
  private approvePartnerTransfer: any;
  private completePartnerTransfer: any;
  private cancelPartnerTransfer: any;
  private rejectPartnerTransfer: any;
  private getPartnerTransfers: any;

  constructor(deps: any) {
    this.createPartnerTransfer   = deps.createPartnerTransfer;
    this.approvePartnerTransfer  = deps.approvePartnerTransfer;
    this.completePartnerTransfer = deps.completePartnerTransfer;
    this.cancelPartnerTransfer   = deps.cancelPartnerTransfer;
    this.rejectPartnerTransfer   = deps.rejectPartnerTransfer;
    this.getPartnerTransfers     = deps.getPartnerTransfers;

    this.create  = this.create.bind(this);
    this.list    = this.list.bind(this);
    this.getOne  = this.getOne.bind(this);
    this.approve = this.approve.bind(this);
    this.complete = this.complete.bind(this);
    this.cancel  = this.cancel.bind(this);
    this.reject  = this.reject.bind(this);
  }

  async getOne(req: any, res: any) {
    const { tenantId } = req.user;
    const { id } = req.params;
    const PartnerTransferModel = (await import('../../../infrastructure/db/models/PartnerTransfer.model')).default;
    const transfer = await PartnerTransferModel.findOne({ _id: id, tenantId })
      .populate('externalAccountId', 'name code')
      .populate('fromBranchId', 'name code')
      .populate('toBranchId', 'name code')
      .lean();
    if (!transfer) {
      const { NotFoundError } = await import('../../../domain/errors');
      throw new NotFoundError('Partner transfer not found');
    }
    res.status(200).json({ success: true, data: transfer });
  }

  async create(req: any, res: any) {
    const { tenantId, id: createdBy, name: createdByName, role } = req.user;
    const createdByRole = role === 'head_office' ? 'head_office' : 'branch';
    const { externalAccountId, fromBranchId, toBranchId, amount, remarks } = req.body;
    const result = await this.createPartnerTransfer.execute({
      tenantId, externalAccountId, fromBranchId, toBranchId,
      amount: Math.round(amount),
      remarks, createdBy, createdByName, createdByRole,
    });
    res.status(201).json({ success: true, data: result });
  }

  async list(req: any, res: any) {
    const { tenantId, branchId, role } = req.user;
    const { externalAccountId, fromBranchId, toBranchId, status, limit, page } = req.query;
    const result = await this.getPartnerTransfers.execute({
      tenantId, externalAccountId, fromBranchId, toBranchId, status,
      branchId, role,
      limit: limit ? parseInt(limit) : 100,
      page: page ? parseInt(page) : 1,
    });
    res.status(200).json({ success: true, data: result });
  }

  async approve(req: any, res: any) {
    const { tenantId, id: userId, name: userName } = req.user;
    const { id: transferId } = req.params;
    const result = await this.approvePartnerTransfer.execute({ tenantId, transferId, userId, userName });
    res.status(200).json({ success: true, data: result });
  }

  async complete(req: any, res: any) {
    const { tenantId, id: userId, name: userName, branchId: userBranchId, role } = req.user;
    const { id: transferId } = req.params;
    const result = await this.completePartnerTransfer.execute({ tenantId, transferId, userId, userName, userBranchId, role });
    res.status(200).json({ success: true, data: result });
  }

  async cancel(req: any, res: any) {
    const { tenantId, id: userId, name: userName, branchId: userBranchId, role } = req.user;
    const { id: transferId } = req.params;
    const { reason } = req.body;
    const result = await this.cancelPartnerTransfer.execute({ tenantId, transferId, userId, userName, userBranchId, role, reason });
    res.status(200).json({ success: true, data: result });
  }

  async reject(req: any, res: any) {
    const { tenantId, id: userId, name: userName } = req.user;
    const { id: transferId } = req.params;
    const { reason } = req.body;
    const result = await this.rejectPartnerTransfer.execute({ tenantId, transferId, userId, userName, reason });
    res.status(200).json({ success: true, data: result });
  }
}
