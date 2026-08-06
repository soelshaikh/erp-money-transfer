import { NotFoundError } from '../../../domain/errors';

export default class CommissionSettlementController {
  private getCommissionPayables: any;
  private getCommissionSettlements: any;
  private createCommissionSettlement: any;
  private completeCommissionSettlement: any;
  private commissionSettlementRepository: any;

  constructor(deps: any) {
    this.getCommissionPayables = deps.getCommissionPayables;
    this.getCommissionSettlements = deps.getCommissionSettlements;
    this.createCommissionSettlement = deps.createCommissionSettlement;
    this.completeCommissionSettlement = deps.completeCommissionSettlement;
    this.commissionSettlementRepository = deps.commissionSettlementRepository;
    this.listPayables = this.listPayables.bind(this);
    this.listSettlements = this.listSettlements.bind(this);
    this.getSettlement = this.getSettlement.bind(this);
    this.create = this.create.bind(this);
    this.complete = this.complete.bind(this);
  }

  async listPayables(req: any, res: any) {
    const { fromBranchId, toBranchId, status, fromDate, toDate, page, limit, summaryOnly } = req.query;
    const result = await this.getCommissionPayables.execute({
      tenantId: req.user.tenantId,
      fromBranchId,
      toBranchId,
      status,
      fromDate,
      toDate,
      page,
      limit,
      summaryOnly: summaryOnly === 'true',
    });
    res.json({ success: true, data: result });
  }

  async listSettlements(req: any, res: any) {
    const { fromBranchId, toBranchId, status, fromDate, toDate, page, limit } = req.query;
    const result = await this.getCommissionSettlements.execute({
      tenantId: req.user.tenantId,
      fromBranchId,
      toBranchId,
      status,
      fromDate,
      toDate,
      page,
      limit,
    });
    res.json({ success: true, data: result });
  }

  async getSettlement(req: any, res: any) {
    const settlement = await this.commissionSettlementRepository.findById(req.user.tenantId, req.params.id);
    if (!settlement) throw new NotFoundError('Commission settlement');
    res.json({ success: true, data: settlement });
  }

  async create(req: any, res: any) {
    const settlement = await this.createCommissionSettlement.execute({
      tenantId: req.user.tenantId,
      fromBranchId: req.body.fromBranchId,
      toBranchId: req.body.toBranchId,
      notes: req.body.notes,
      initiatedBy: req.user.id,
      initiatedByName: req.user.name,
    });
    res.status(201).json({ success: true, data: settlement });
  }

  async complete(req: any, res: any) {
    const settlement = await this.completeCommissionSettlement.execute({
      tenantId: req.user.tenantId,
      settlementId: req.params.id,
      completedBy: req.user.id,
      completedByName: req.user.name,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: settlement });
  }
}
