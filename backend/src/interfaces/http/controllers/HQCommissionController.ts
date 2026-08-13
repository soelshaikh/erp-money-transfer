import { ROLES } from '../../../config/constants';
import { HQSettlementStatus, InitiatedBySide, PaymentMode } from '../../../domain/types/hqCommission.types';

export default class HQCommissionController {
  private getHQCommissionItems: any;
  private createHQCommissionSettlement: any;
  private getHQCommissionSettlements: any;
  private getHQCommissionSettlement: any;
  private completeHQCommissionSettlement: any;

  constructor(deps: {
    getHQCommissionItems: any;
    createHQCommissionSettlement: any;
    getHQCommissionSettlements: any;
    getHQCommissionSettlement: any;
    completeHQCommissionSettlement: any;
  }) {
    this.getHQCommissionItems = deps.getHQCommissionItems;
    this.createHQCommissionSettlement = deps.createHQCommissionSettlement;
    this.getHQCommissionSettlements = deps.getHQCommissionSettlements;
    this.getHQCommissionSettlement = deps.getHQCommissionSettlement;
    this.completeHQCommissionSettlement = deps.completeHQCommissionSettlement;

    this.listItems = this.listItems.bind(this);
    this.createSettlement = this.createSettlement.bind(this);
    this.listSettlements = this.listSettlements.bind(this);
    this.getSettlement = this.getSettlement.bind(this);
    this.completeSettlement = this.completeSettlement.bind(this);
  }

  async listItems(req: any, res: any): Promise<void> {
    const { tenantId, role, branchId } = req.user;
    const filterBranchId = role !== ROLES.BRANCH ? req.query.branchId as string | undefined : undefined;

    const items = await this.getHQCommissionItems.execute({
      tenantId,
      role,
      branchId,
      filterBranchId,
    });
    res.json({ success: true, data: items });
  }

  async createSettlement(req: any, res: any): Promise<void> {
    const { tenantId, id: userId, role, branchId: userBranchId, name: actorName, username: actorUsername } = req.user;

    const targetBranchId: string = role === ROLES.BRANCH
      ? (userBranchId as string)
      : (req.body.branchId as string);

    const settlement = await this.createHQCommissionSettlement.execute({
      tenantId,
      branchId: targetBranchId,
      itemIds: req.body.itemIds as string[],
      paymentMode: req.body.paymentMode as PaymentMode,
      notes: req.body.notes as string | undefined,
      initiatedBySide: (role === ROLES.BRANCH ? 'branch' : 'head_office') as InitiatedBySide,
      userId,
      actorName,
      actorUsername,
    });
    res.status(201).json({ success: true, data: settlement });
  }

  async listSettlements(req: any, res: any): Promise<void> {
    const { tenantId, role, branchId } = req.user;
    const filterBranchId = role !== ROLES.BRANCH ? req.query.branchId as string | undefined : undefined;
    const status = req.query.status as HQSettlementStatus | undefined;

    const result = await this.getHQCommissionSettlements.execute({
      tenantId,
      role,
      branchId,
      filterBranchId,
      status,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  }

  async getSettlement(req: any, res: any): Promise<void> {
    const { tenantId } = req.user;
    const settlement = await this.getHQCommissionSettlement.execute({
      tenantId,
      settlementId: req.params.id as string,
    });
    res.json({ success: true, data: settlement });
  }

  async completeSettlement(req: any, res: any): Promise<void> {
    const { tenantId, id: userId, name: actorName, username: actorUsername } = req.user;
    const settlement = await this.completeHQCommissionSettlement.execute({
      tenantId,
      settlementId: req.params.id as string,
      userId,
      actorName,
      actorUsername,
    });
    res.json({ success: true, data: settlement });
  }
}
