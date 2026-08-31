import { AUDIT_ACTIONS, MODULES, NOTIFICATION_TYPE } from '../../../config/constants';
import { NotFoundError, ConflictError } from '../../../domain/errors';
import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';

export default class RejectTransaction {
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
    const { tenantId, transactionId, userId, remarks, actorName, actorUsername } = params;

    const transaction = await this.transactionRepository.rejectAtomic(tenantId, transactionId, userId, remarks);

    if (!transaction) {
      const existing = await this.transactionRepository.findById(tenantId, transactionId);
      if (!existing) throw new NotFoundError('Transaction');
      throw new ConflictError(`Transaction already ${existing.approvalStatus}`);
    }

    // Cancel commission payable if one exists — transaction rejected, commission will never be earned
    this.commissionPayableRepository.updateStatusByTransactionId(tenantId, transactionId, 'cancelled').catch(() => {});

    // Release per-branch partner on-hold if a partner was linked
    const partnerCovered = transaction.partnerCoveredAmount || 0;
    if (transaction.externalAccountId && partnerCovered > 0) {
      const collBranchId = transaction.collectionBranchId.toString();
      ExternalAccountModel.updateOne(
        { _id: transaction.externalAccountId, tenantId },
        { $inc: { [`onHolds.${collBranchId}`]: -partnerCovered } },
      ).catch(() => {});
    }

    // Reverse the collection credit exactly as it was made at creation — the full amount,
    // regardless of partner coverage (partner balance no longer nets out of the branch's own
    // ledger; see CreateTransaction.ts). For collection-side, the original credit included
    // commission (branchPortion + commissionAmount), so the reversal must include it too.
    const branchPortion = transaction.amount;
    const isCollectionSide = !transaction.commissionSide || transaction.commissionSide === 'collection';
    const branchReversal = isCollectionSide ? branchPortion + (transaction.commissionAmount || 0) : branchPortion;
    if (branchReversal > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, transaction.collectionBranchId.toString(), {
        transactionId: transaction._id,
        type: 'debit',
        amount: branchReversal,
        description: `Cancelled — Token ${transaction.tokenNumber} reversed. Reason: ${remarks || 'N/A'}`,
        event: 'collection_reversed',
        tokenNumber: transaction.tokenNumber,
      });
    }

    this.notificationService.notifyBranch(tenantId, transaction.collectionBranchId.toString(), {
      type: NOTIFICATION_TYPE.TRANSACTION_REJECTED,
      title: 'Transaction Rejected',
      body: `Token ${transaction.tokenNumber} was rejected. Reason: ${remarks || 'N/A'}`,
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
      action: AUDIT_ACTIONS.REJECT,
      module: MODULES.TRANSACTION,
      entityId: transactionId,
      before: { approvalStatus: 'pending' },
      after: {
        approvalStatus: 'rejected',
        remarks,
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
