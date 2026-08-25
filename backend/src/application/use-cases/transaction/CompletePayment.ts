import { AUDIT_ACTIONS, COMMISSION_SIDE, MODULES, NOTIFICATION_TYPE, ROLES } from '../../../config/constants';
import { NotFoundError, BusinessRuleError } from '../../../domain/errors';
import IHQCommissionItemRepository from '../../ports/IHQCommissionItemRepository';
import Commission from '../../../domain/value-objects/Commission';
import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import { todayIST } from '../../../utils/dateIST';

export default class CompletePayment {
  transactionRepository: any;
  notificationService: any;
  auditService: any;
  branchLedgerRepository: any;
  branchRepository: any;
  tenantRepository: any;
  commissionPayableRepository: any;
  private hqCommissionItemRepository: IHQCommissionItemRepository;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
    this.notificationService = deps.notificationService;
    this.auditService = deps.auditService;
    this.branchLedgerRepository = deps.branchLedgerRepository;
    this.branchRepository = deps.branchRepository;
    this.tenantRepository = deps.tenantRepository;
    this.commissionPayableRepository = deps.commissionPayableRepository;
    this.hqCommissionItemRepository = deps.hqCommissionItemRepository;
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

    const isPayoutSide = (transaction.commissionSide === COMMISSION_SIDE.PAYOUT || transaction.commissionSide === COMMISSION_SIDE.PAYOUT_EXTRA);

    // Fetch tenant up front whenever there's commission to handle — needed to decide between
    // the enterprise 3-way split and the legacy aangadia single-branch + masterCommissionPct
    // flow, on both sides (the legacy masterCommissionPct path below needs businessType too).
    // Enterprise + payout-side: the split is computed now (before completion is persisted) so
    // its snapshot can be saved on the transaction in the same update as payoutPhotoUrl.
    let tenant: any = null;
    let commissionSplitParts: ReturnType<typeof Commission.splitEnterprise> | null = null;
    let commissionSplitSnapshot: any = null;
    if (transaction.commissionAmount > 0) {
      tenant = await this.tenantRepository.findById(tenantId);
      if (isPayoutSide && tenant?.businessType === 'enterprise') {
        const split = tenant.settings?.commissionSplit;
        if (split?.branchPct == null || split?.headOfficePct == null || (2 * split.branchPct + split.headOfficePct !== 100)) {
          throw new BusinessRuleError('Commission split (branch % / head office %) is not configured for this company — cannot complete payment');
        }
        commissionSplitParts = Commission.splitEnterprise(transaction.commissionAmount, split.branchPct, split.headOfficePct);
        commissionSplitSnapshot = {
          earningBranchId: transaction.payoutBranchId,
          ownShareAmount: commissionSplitParts.ownShareAmount,
          otherBranchId: transaction.collectionBranchId,
          otherBranchShareAmount: commissionSplitParts.otherBranchShareAmount,
          headOfficeOwnShareAmount: commissionSplitParts.headOfficeOwnShareAmount,
        };
      }
    }

    const completed = await this.transactionRepository.completePayment(tenantId, transactionId, {
      payoutPhotoUrl: payoutPhotoUrl || null,
      ...(commissionSplitSnapshot && { commissionSplit: commissionSplitSnapshot }),
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

    // Receiver-side partner (Lenar) — branch still pays finalAmount out in full (above,
    // unchanged); the partner's balance separately moves toward "OWES US" by the same
    // amount, since the branch fronted that cash on the partner's behalf. No cap/onHold —
    // unlike the sender side, this is new debt, not consumption of existing credit.
    if (completed.payoutExternalAccountId && completed.finalAmount > 0) {
      const payoutPartner = await ExternalAccountModel.findOne({ _id: completed.payoutExternalAccountId, tenantId });
      if (payoutPartner) {
        const balBefore = payoutPartner.balance;
        const balAfter = balBefore - completed.finalAmount;
        await ExternalLedgerModel.create({
          tenantId,
          externalAccountId: payoutPartner._id,
          transactionId: completed._id,
          type: 'due',
          direction: 'debit',
          amount: completed.finalAmount,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          description: `Token ${completed.tokenNumber} — paid out on partner's behalf`,
          entryDate: todayIST(),
          createdBy: userId,
          createdByName: actorName || null,
        });
        await ExternalAccountModel.updateOne(
          { _id: payoutPartner._id, tenantId },
          { $inc: { balance: -completed.finalAmount } },
        );
      }
    }

    // Fetch branches once — needed for commission descriptions, CommissionPayable record, and audit
    const [collectionBranch, payoutBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, completed.collectionBranchId.toString()),
      this.branchRepository.findById(tenantId, completed.payoutBranchId.toString()),
    ]);

    // Commission handling — only applies when payout/payout_extra side and commission > 0
    let creditToSender = false;
    if (isPayoutSide && completed.commissionAmount > 0 && tenant?.businessType === 'enterprise' && commissionSplitParts) {
      // Enterprise: payout branch earns the full commission immediately — unchanged amount/
      // timing from today — then settles its combined share with Head Office alone.
      // masterCommissionPct and creditCommissionToSendingBranch are bypassed entirely.
      await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
        transactionId: completed._id,
        type: 'credit',
        amount: completed.commissionAmount,
        description: `Commission earned ₹${completed.commissionAmount} — Token ${completed.tokenNumber}`,
        event: 'commission_earned',
        tokenNumber: completed.tokenNumber,
      });

      this.hqCommissionItemRepository.create({
        tenantId,
        branchId: completed.payoutBranchId,
        branchName: payoutBranch?.name || '',
        branchCode: payoutBranch?.code || '',
        transactionId: completed._id,
        tokenNumber: completed.tokenNumber,
        commissionAmount: completed.commissionAmount,
        hqSharePct: commissionSplitParts.hqSharePct,
        hqShareAmount: commissionSplitParts.hqShareAmount,
        otherBranchId: completed.collectionBranchId,
        otherBranchName: collectionBranch?.name || '',
        otherBranchCode: collectionBranch?.code || '',
        otherBranchShareAmount: commissionSplitParts.otherBranchShareAmount,
        headOfficeOwnShareAmount: commissionSplitParts.headOfficeOwnShareAmount,
      }).catch(() => {});
    } else if (isPayoutSide && completed.commissionAmount > 0) {
      creditToSender = tenant?.features?.creditCommissionToSendingBranch === true;

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

    // Legacy masterCommissionPct-based HQ item creation — aangadia tenants only. Enterprise
    // tenants are handled entirely above (payout-side) or in CreateTransaction.ts (collection-side).
    if (tenant?.businessType !== 'enterprise') {
      const earningBranch = isPayoutSide ? payoutBranch : collectionBranch;
      const hqSharePct: number = (earningBranch?.masterCommissionPct ?? 0);
      if (completed.commissionAmount > 0 && hqSharePct > 0 && !creditToSender) {
        this.hqCommissionItemRepository.create({
          tenantId,
          branchId: earningBranch._id,
          branchName: earningBranch.name as string,
          branchCode: earningBranch.code as string,
          transactionId: completed._id,
          tokenNumber: completed.tokenNumber,
          commissionAmount: completed.commissionAmount,
          hqSharePct,
          hqShareAmount: Math.round(completed.commissionAmount * hqSharePct / 100),
        }).catch(() => {});
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
