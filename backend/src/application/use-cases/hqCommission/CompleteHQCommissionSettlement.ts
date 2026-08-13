import { NotFoundError, BusinessRuleError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';
import IHQCommissionSettlementRepository from '../../ports/IHQCommissionSettlementRepository';
import IHQCommissionItemRepository from '../../ports/IHQCommissionItemRepository';
import IBranchLedgerRepository from '../../ports/IBranchLedgerRepository';
import IBranchRepository from '../../ports/IBranchRepository';
import IAuditService from '../../ports/IAuditService';
import {
  CompleteHQSettlementParams,
  HQCommissionSettlementDoc,
} from '../../../domain/types/hqCommission.types';

export default class CompleteHQCommissionSettlement {
  private hqCommissionSettlementRepository: IHQCommissionSettlementRepository;
  private hqCommissionItemRepository: IHQCommissionItemRepository;
  private branchLedgerRepository: IBranchLedgerRepository;
  private branchRepository: IBranchRepository;
  private auditService: IAuditService;

  constructor(deps: {
    hqCommissionSettlementRepository: IHQCommissionSettlementRepository;
    hqCommissionItemRepository: IHQCommissionItemRepository;
    branchLedgerRepository: IBranchLedgerRepository;
    branchRepository: IBranchRepository;
    auditService: IAuditService;
  }) {
    this.hqCommissionSettlementRepository = deps.hqCommissionSettlementRepository;
    this.hqCommissionItemRepository = deps.hqCommissionItemRepository;
    this.branchLedgerRepository = deps.branchLedgerRepository;
    this.branchRepository = deps.branchRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: CompleteHQSettlementParams): Promise<HQCommissionSettlementDoc> {
    const { tenantId, settlementId, userId, actorName, actorUsername } = params;

    const settlement = await this.hqCommissionSettlementRepository.findById(tenantId, settlementId);
    if (!settlement) throw new NotFoundError('HQ commission settlement');
    if (settlement.status === 'completed') throw new BusinessRuleError('Settlement already completed');

    const completed = await this.hqCommissionSettlementRepository.complete(tenantId, settlementId, userId, actorName);
    if (!completed) throw new BusinessRuleError('Settlement already completed');

    const { totalHQShare, branchId, branchName, branchCode, itemIds } = settlement;
    const ref = `HQSETTLE-${completed._id.toString().slice(-6).toUpperCase()}`;

    // Debit earning branch by the HQ share amount
    await this.branchLedgerRepository.addEntry(tenantId, branchId.toString(), {
      transactionId: completed._id,
      type: 'debit',
      amount: totalHQShare,
      description: `HQ commission settlement ₹${totalHQShare} — ${ref}`,
      event: 'hq_commission_out',
      tokenNumber: ref,
    });

    // Credit head_office branch if one exists for this tenant (optional — silently skipped if absent)
    const hoBranch = await this.branchRepository.findHeadOfficeBranch(tenantId);
    if (hoBranch) {
      await this.branchLedgerRepository.addEntry(tenantId, hoBranch._id.toString(), {
        transactionId: completed._id,
        type: 'credit',
        amount: totalHQShare,
        description: `HQ commission received from ${branchName} (${branchCode}) — ${ref}`,
        event: 'hq_commission_in',
        tokenNumber: ref,
      });
    }

    const ids = itemIds.map((id) => id.toString());
    await this.hqCommissionItemRepository.markSettled(tenantId, ids);

    this.auditService.log({
      tenantId,
      userId,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.HQ_COMMISSION_SETTLEMENT,
      module: MODULES.HQ_COMMISSION,
      entityId: settlementId,
      before: { status: 'pending' },
      after: {
        status: 'completed',
        totalHQShare,
        branchName,
        branchCode,
        ref,
        hoBalanceCredited: !!hoBranch,
      },
    });

    return completed;
  }
}
