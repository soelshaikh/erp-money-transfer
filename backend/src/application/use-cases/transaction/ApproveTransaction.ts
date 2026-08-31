import { AUDIT_ACTIONS, MODULES, NOTIFICATION_TYPE } from '../../../config/constants';
import { NotFoundError, ConflictError } from '../../../domain/errors';
import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import { todayIST } from '../../../utils/dateIST';

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

    // Partner (ExternalAccount) ledger deduction at approval
    if (transaction.externalAccountId) {
      const partner = await ExternalAccountModel.findOne({ _id: transaction.externalAccountId, tenantId });
      if (partner) {
        const partnerCovered = transaction.partnerCoveredAmount || 0;
        const totalDeducted = transaction.amount;
        const dueAmount = totalDeducted - partnerCovered;
        const today = todayIST();
        const collBranchId = transaction.collectionBranchId.toString();

        // Use branch-specific balance for balanceBefore/After in ledger entries
        const branchBalBefore = (partner.balances as any)?.get?.(collBranchId)
          ?? (partner.balances as any)?.[collBranchId]
          ?? partner.balance;
        let runningBranchBalance = branchBalBefore;

        // Entry 1: consume the credit that was on hold
        if (partnerCovered > 0) {
          const balBefore = runningBranchBalance;
          const balAfter = runningBranchBalance - partnerCovered;
          await ExternalLedgerModel.create({
            tenantId,
            externalAccountId: partner._id,
            transactionId: transaction._id,
            branchId: transaction.collectionBranchId,
            type: 'withdrawal',
            direction: 'debit',
            amount: partnerCovered,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            description: `Token ${transaction.tokenNumber} — credit consumed`,
            entryDate: today,
            createdBy: userId,
            createdByName: actorName || null,
          });
          runningBranchBalance = balAfter;
        }

        // Entry 2: due for amount beyond available credit
        if (dueAmount > 0) {
          const balBefore = runningBranchBalance;
          const balAfter = runningBranchBalance - dueAmount;
          await ExternalLedgerModel.create({
            tenantId,
            externalAccountId: partner._id,
            transactionId: transaction._id,
            branchId: transaction.collectionBranchId,
            type: 'due',
            direction: 'debit',
            amount: dueAmount,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            description: `Token ${transaction.tokenNumber} — outstanding due`,
            entryDate: today,
            createdBy: userId,
            createdByName: actorName || null,
          });
        }
        await ExternalAccountModel.updateOne(
          { _id: partner._id, tenantId },
          { $inc: { balance: -totalDeducted, [`onHolds.${collBranchId}`]: -partnerCovered, [`balances.${collBranchId}`]: -totalDeducted } },
        );
      }
    }

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
