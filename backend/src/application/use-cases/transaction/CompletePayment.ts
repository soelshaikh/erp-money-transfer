import { AUDIT_ACTIONS, COMMISSION_SIDE, MODULES, NOTIFICATION_TYPE, ROLES } from '../../../config/constants';
import { NotFoundError, BusinessRuleError } from '../../../domain/errors';

export default class CompletePayment {
  transactionRepository: any;
  notificationService: any;
  auditService: any;
  branchLedgerRepository: any;
  branchRepository: any;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
    this.notificationService = deps.notificationService;
    this.auditService = deps.auditService;
    this.branchLedgerRepository = deps.branchLedgerRepository;
    this.branchRepository = deps.branchRepository;
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

    // Payout debit — always finalAmount (correct for both commission sides)
    await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
      transactionId: completed._id,
      type: 'debit',
      amount: completed.finalAmount,
      description: `Paid out ₹${completed.finalAmount} — Token ${completed.tokenNumber}`,
      event: 'payout_completed',
      tokenNumber: completed.tokenNumber,
    });

    // Payout side: payout branch earns the commission — credit it now that payment is done
    if (completed.commissionSide === COMMISSION_SIDE.PAYOUT && completed.commissionAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
        transactionId: completed._id,
        type: 'credit',
        amount: completed.commissionAmount,
        description: `Commission earned ₹${completed.commissionAmount} — Token ${completed.tokenNumber}`,
        event: 'commission_earned',
        tokenNumber: completed.tokenNumber,
      });
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

    const [collectionBranch, payoutBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, completed.collectionBranchId.toString()),
      this.branchRepository.findById(tenantId, completed.payoutBranchId.toString()),
    ]);

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
