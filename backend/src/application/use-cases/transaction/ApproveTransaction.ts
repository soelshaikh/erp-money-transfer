import { AUDIT_ACTIONS, MODULES, NOTIFICATION_TYPE } from '../../../config/constants';
import { NotFoundError, ConflictError } from '../../../domain/errors';

export default class ApproveTransaction {
  transactionRepository: any;
  notificationService: any;
  auditService: any;
  branchLedgerRepository: any;
  branchRepository: any;
  commissionPayableRepository: any;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
    this.notificationService = deps.notificationService;
    this.auditService = deps.auditService;
    this.branchLedgerRepository = deps.branchLedgerRepository;
    this.branchRepository = deps.branchRepository;
    this.commissionPayableRepository = deps.commissionPayableRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, transactionId, userId, actorName, actorUsername } = params;

    const transaction = await this.transactionRepository.approveAtomic(tenantId, transactionId, userId);

    if (!transaction) {
      const existing = await this.transactionRepository.findById(tenantId, transactionId);
      if (!existing) throw new NotFoundError('Transaction');
      throw new ConflictError(`Transaction already ${existing.approvalStatus}`);
    }

    // Advance commission payable lifecycle if one exists for this transaction
    this.commissionPayableRepository.updateStatusByTransactionId(tenantId, transactionId, 'approved').catch(() => {});

    // Commit payout — first time payout branch balance is affected (pending_payout no longer written at creation)
    await this.branchLedgerRepository.addEntry(tenantId, transaction.payoutBranchId.toString(), {
      transactionId: transaction._id,
      type: 'committed_debit',
      amount: transaction.finalAmount,
      description: `Committed payout ₹${transaction.finalAmount} — Token ${transaction.tokenNumber}`,
      event: 'payout_committed',
      tokenNumber: transaction.tokenNumber,
    });

    this.notificationService.notifyBranch(tenantId, transaction.payoutBranchId.toString(), {
      type: NOTIFICATION_TYPE.TRANSACTION_APPROVED,
      title: 'Transaction Approved',
      body: `Token ${transaction.tokenNumber} approved — ready for payout`,
      data: { transactionId: transaction._id, tokenNumber: transaction.tokenNumber },
    }).catch(() => {});

    const [collectionBranch, payoutBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, transaction.collectionBranchId.toString()),
      this.branchRepository.findById(tenantId, transaction.payoutBranchId.toString()),
    ]);

    this.auditService.log({
      tenantId,
      userId,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.APPROVE,
      module: MODULES.TRANSACTION,
      entityId: transactionId,
      before: { approvalStatus: 'pending' },
      after: {
        approvalStatus: 'approved',
        tokenNumber: transaction.tokenNumber,
        amount: transaction.amount,
        commissionAmount: transaction.commissionAmount,
        finalAmount: transaction.finalAmount,
        collectionBranchName: collectionBranch?.name,
        collectionBranchCode: collectionBranch?.code,
        payoutBranchName: payoutBranch?.name,
        payoutBranchCode: payoutBranch?.code,
      },
    });

    return transaction;
  }
}
