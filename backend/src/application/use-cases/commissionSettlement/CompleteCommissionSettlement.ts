import { NotFoundError, BusinessRuleError } from '../../../domain/errors';
import { AUDIT_ACTIONS, MODULES } from '../../../config/constants';

export default class CompleteCommissionSettlement {
  commissionPayableRepository: any;
  commissionSettlementRepository: any;
  branchLedgerRepository: any;
  auditService: any;

  constructor(deps: any) {
    this.commissionPayableRepository = deps.commissionPayableRepository;
    this.commissionSettlementRepository = deps.commissionSettlementRepository;
    this.branchLedgerRepository = deps.branchLedgerRepository;
    this.auditService = deps.auditService;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, settlementId, completedBy, completedByName, actorName, actorUsername } = params;

    const settlement = await this.commissionSettlementRepository.findById(tenantId, settlementId);
    if (!settlement) throw new NotFoundError('Commission settlement');
    if (settlement.status === 'completed') throw new BusinessRuleError('Settlement already completed');

    // Mark settlement as completed
    const completed = await this.commissionSettlementRepository.complete(tenantId, settlementId, completedBy, completedByName);
    if (!completed) throw new BusinessRuleError('Settlement already completed');

    // Mark all included payables as settled
    const payableIds = settlement.payableIds.map((id: any) => id.toString());
    await this.commissionPayableRepository.markSettled(tenantId, payableIds);

    const { totalAmount, fromBranchId, toBranchId, fromBranchName, toBranchName, fromBranchCode, toBranchCode } = settlement;
    const settlementRef = `SETTLE-${completed._id.toString().slice(-6).toUpperCase()}`;

    // Payout branch (fromBranch): commission_settlement_out — actual cash transferred out, liability cleared
    await this.branchLedgerRepository.addEntry(
      tenantId,
      fromBranchId.toString(),
      {
        transactionId: completed._id,
        type: 'debit',
        amount: totalAmount,
        description: `Commission settlement to ${toBranchName} (${toBranchCode}) — ${settlementRef}`,
        event: 'commission_settlement_out',
        tokenNumber: settlementRef,
      },
    );

    // Collection branch (toBranch): commission_settlement_in — cash received, receivable cleared
    await this.branchLedgerRepository.addEntry(
      tenantId,
      toBranchId.toString(),
      {
        transactionId: completed._id,
        type: 'credit',
        amount: totalAmount,
        description: `Commission received from ${fromBranchName} (${fromBranchCode}) — ${settlementRef}`,
        event: 'commission_settlement_in',
        tokenNumber: settlementRef,
      },
    );

    this.auditService.log({
      tenantId,
      userId: completedBy,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.COMMISSION_SETTLEMENT,
      module: MODULES.COMMISSION_SETTLEMENT,
      entityId: settlementId,
      before: { status: 'pending' },
      after: {
        status: 'completed',
        totalAmount,
        transactionCount: settlement.transactionCount,
        fromBranch: `${fromBranchName} (${fromBranchCode})`,
        toBranch: `${toBranchName} (${toBranchCode})`,
        settlementRef,
      },
    });

    return completed;
  }
}
