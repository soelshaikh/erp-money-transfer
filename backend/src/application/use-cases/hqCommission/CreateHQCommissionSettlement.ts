import { BusinessRuleError, NotFoundError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import IHQCommissionItemRepository from '../../ports/IHQCommissionItemRepository';
import IHQCommissionSettlementRepository from '../../ports/IHQCommissionSettlementRepository';
import IBranchRepository from '../../ports/IBranchRepository';
import IAuditService from '../../ports/IAuditService';
import {
  CreateHQSettlementParams,
  HQCommissionSettlementDoc,
} from '../../../domain/types/hqCommission.types';

export default class CreateHQCommissionSettlement {
  private hqCommissionItemRepository: IHQCommissionItemRepository;
  private hqCommissionSettlementRepository: IHQCommissionSettlementRepository;
  private branchRepository: IBranchRepository;
  private auditService: IAuditService;

  constructor(deps: {
    hqCommissionItemRepository: IHQCommissionItemRepository;
    hqCommissionSettlementRepository: IHQCommissionSettlementRepository;
    branchRepository: IBranchRepository;
    auditService: IAuditService;
  }) {
    this.hqCommissionItemRepository = deps.hqCommissionItemRepository;
    this.hqCommissionSettlementRepository = deps.hqCommissionSettlementRepository;
    this.branchRepository = deps.branchRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: CreateHQSettlementParams): Promise<HQCommissionSettlementDoc> {
    const { tenantId, branchId, itemIds, paymentMode, notes, initiatedBySide, userId, actorName, actorUsername } = params;

    if (!itemIds || itemIds.length === 0) {
      throw new BusinessRuleError('Select at least one commission item');
    }

    const branch = await this.branchRepository.findById(tenantId, branchId);
    if (!branch) throw new NotFoundError('Branch');

    const items = await this.hqCommissionItemRepository.findByIds(tenantId, itemIds);
    if (items.length !== itemIds.length) {
      throw new BusinessRuleError('One or more commission items not found');
    }

    for (const item of items) {
      if (item.branchId.toString() !== branchId) {
        throw new BusinessRuleError('All items must belong to the same branch');
      }
      if (item.status !== 'pending') {
        throw new BusinessRuleError(`Item for token ${item.tokenNumber} is already in a settlement`);
      }
    }

    const totalCommission = items.reduce((sum, i) => sum + i.commissionAmount, 0);
    const totalHQShare = items.reduce((sum, i) => sum + i.hqShareAmount, 0);

    const settlement = await this.hqCommissionSettlementRepository.create({
      tenantId,
      branchId,
      branchName: branch.name as string,
      branchCode: branch.code as string,
      itemIds,
      itemCount: itemIds.length,
      totalCommission,
      totalHQShare,
      paymentMode,
      notes: notes ?? null,
      status: 'pending',
      initiatedBySide,
      initiatedBy: userId,
      initiatedByName: actorName,
      initiatedAt: new Date(),
    });

    await this.hqCommissionItemRepository.markInSettlement(tenantId, itemIds, settlement._id.toString());

    this.auditService.log({
      tenantId,
      userId,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.HQ_COMMISSION_SETTLEMENT,
      module: MODULES.HQ_COMMISSION,
      entityId: settlement._id.toString(),
      after: {
        branchName: branch.name,
        branchCode: branch.code,
        itemCount: itemIds.length,
        totalCommission,
        totalHQShare,
        paymentMode,
        initiatedBySide,
      },
    });

    return settlement;
  }
}
