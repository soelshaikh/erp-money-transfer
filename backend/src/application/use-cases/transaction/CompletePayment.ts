import { AUDIT_ACTIONS, COMMISSION_SIDE, MODULES, NOTIFICATION_TYPE, ROLES } from '../../../config/constants';
import { NotFoundError, BusinessRuleError } from '../../../domain/errors';

export default class CompletePayment {
  transactionRepository: any;
  notificationService: any;
  auditService: any;
  branchLedgerRepository: any;
  branchRepository: any;
  tenantRepository: any;
  commissionPayableRepository: any;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
    this.notificationService = deps.notificationService;
    this.auditService = deps.auditService;
    this.branchLedgerRepository = deps.branchLedgerRepository;
    this.branchRepository = deps.branchRepository;
    this.tenantRepository = deps.tenantRepository;
    this.commissionPayableRepository = deps.commissionPayableRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, transactionId, userId, payoutPhotoUrl, actorName, actorUsername } = params;

    const transaction = await this.transactionRepository.findById(tenantId, transactionId);
    if (!transaction) throw new NotFoundError('Transaction');

    if (transaction.approvalStatus !== 'approved') {
      throw new BusinessRuleError('Transaction is not approved');
    }
    if (transaction.paymentStatus !== 'pending') {
      throw new BusinessRuleError('Transaction already completed');
    }

    const completed = await this.transactionRepository.completePayment(tenantId, transactionId, {
      payoutPhotoUrl: payoutPhotoUrl || null,
    });
    if (!completed) throw new BusinessRuleError('Transaction already completed');

    // Payout debit — always finalAmount (correct for all commission sides)
    await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
      transactionId: completed._id,
      type: 'debit',
      amount: completed.finalAmount,
      description: `Paid out ₹${completed.finalAmount} — Token ${completed.tokenNumber}`,
      event: 'payout_completed',
      tokenNumber: completed.tokenNumber,
    });

    // Fetch branches once — needed for commission descriptions, CommissionPayable record, and audit
    const [collectionBranch, payoutBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, completed.collectionBranchId.toString()),
      this.branchRepository.findById(tenantId, completed.payoutBranchId.toString()),
    ]);

    // Commission handling — only applies when payout/payout_extra side and commission > 0
    const isPayoutSide = (completed.commissionSide === COMMISSION_SIDE.PAYOUT || completed.commissionSide === 'payout_extra');
    if (isPayoutSide && completed.commissionAmount > 0) {
      const tenant = await this.tenantRepository.findById(tenantId);
      const creditToSender = tenant?.features?.creditCommissionToSendingBranch === true;

      if (creditToSender) {
        // Flag ON: payout branch owes commission to collection (sending) branch
        const collName = collectionBranch ? `${collectionBranch.name} (${collectionBranch.code})` : 'collection branch';
        const payName = payoutBranch ? `${payoutBranch.name} (${payoutBranch.code})` : 'payout branch';

        // Payout branch: commissionPayable increases — effective balance drops
        await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
          transactionId: completed._id,
          type: 'debit',
          amount: completed.commissionAmount,
          description: `Commission payable to ${collName} — Token ${completed.tokenNumber}`,
          event: 'commission_payable',
          tokenNumber: completed.tokenNumber,
        });

        // Collection branch: commissionReceivable increases — effective balance rises
        await this.branchLedgerRepository.addEntry(tenantId, completed.collectionBranchId.toString(), {
          transactionId: completed._id,
          type: 'credit',
          amount: completed.commissionAmount,
          description: `Commission receivable from ${payName} — Token ${completed.tokenNumber}`,
          event: 'commission_receivable',
          tokenNumber: completed.tokenNumber,
        });

        // Advance CommissionPayable to pending_settlement (created at expected on transaction creation)
        // If record doesn't exist (flag was OFF at creation), create it now as a safety net
        const existing = await this.commissionPayableRepository.findByTransactionId(tenantId, completed._id.toString());
        if (existing) {
          await this.commissionPayableRepository.updateStatusByTransactionId(tenantId, completed._id.toString(), 'pending_settlement');
        } else {
          await this.commissionPayableRepository.create({
            tenantId,
            fromBranchId: completed.payoutBranchId,
            fromBranchName: payoutBranch?.name || '',
            fromBranchCode: payoutBranch?.code || '',
            toBranchId: completed.collectionBranchId,
            toBranchName: collectionBranch?.name || '',
            toBranchCode: collectionBranch?.code || '',
            transactionId: completed._id,
            tokenNumber: completed.tokenNumber,
            amount: completed.commissionAmount,
            status: 'pending_settlement',
          });
        }
      } else {
        // Flag OFF (default): payout branch earns commission immediately
        await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
          transactionId: completed._id,
          type: 'credit',
          amount: completed.commissionAmount,
          description: `Commission earned ₹${completed.commissionAmount} — Token ${completed.tokenNumber}`,
          event: 'commission_earned',
          tokenNumber: completed.tokenNumber,
        });
      }
    }

    this.notificationService.notifyBranch(tenantId, completed.collectionBranchId.toString(), {
      type: NOTIFICATION_TYPE.PAYMENT_COMPLETED,
      title: 'Payment Completed',
      body: `Token ${completed.tokenNumber} — ₹${completed.finalAmount} paid to receiver`,
      data: { transactionId: completed._id, tokenNumber: completed.tokenNumber },
    }).catch(() => {});

    this.notificationService.notifyRole(tenantId, ROLES.HEAD_OFFICE, {
      type: NOTIFICATION_TYPE.PAYMENT_COMPLETED,
      title: 'Payment Completed',
      body: `Token ${completed.tokenNumber} has been completed. Amount: ₹${completed.amount}`,
      data: { transactionId: completed._id, tokenNumber: completed.tokenNumber, amount: completed.amount },
    }).catch(() => {});

    this.auditService.log({
      tenantId,
      userId,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.PAYMENT_COMPLETE,
      module: MODULES.TRANSACTION,
      entityId: transactionId,
      before: { paymentStatus: 'pending' },
      after: {
        paymentStatus: 'completed',
        tokenNumber: completed.tokenNumber,
        amount: completed.amount,
        commissionAmount: completed.commissionAmount,
        finalAmount: completed.finalAmount,
        collectionBranchName: collectionBranch?.name,
        collectionBranchCode: collectionBranch?.code,
        payoutBranchName: payoutBranch?.name,
        payoutBranchCode: payoutBranch?.code,
      },
    });

    return completed;
  }
}
