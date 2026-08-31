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
    const { tenantId, transactionId, userId, payoutPhotoUrl, commissionDeducted, actorName, actorUsername } = params;

    const transaction = await this.transactionRepository.findById(tenantId, transactionId);
    if (!transaction) throw new NotFoundError('Transaction');

    if (transaction.approvalStatus !== 'approved') {
      throw new BusinessRuleError('Transaction is not approved');
    }
    if (transaction.paymentStatus !== 'pending') {
      throw new BusinessRuleError('Transaction already completed');
    }

    const isPayoutSide = (transaction.commissionSide === COMMISSION_SIDE.PAYOUT || transaction.commissionSide === COMMISSION_SIDE.PAYOUT_EXTRA);

    // Resolve mode early — needed for the earning-branch snapshot saved on the transaction.
    const useExtraMode = !commissionDeducted;

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
        // Earning branch depends on mode: extra → payout branch collects from receiver; deduct → collection branch retains
        const earningBranchId = useExtraMode ? transaction.payoutBranchId : transaction.collectionBranchId;
        const otherBranchId   = useExtraMode ? transaction.collectionBranchId : transaction.payoutBranchId;
        commissionSplitSnapshot = {
          earningBranchId,
          ownShareAmount: commissionSplitParts.ownShareAmount,
          otherBranchId,
          otherBranchShareAmount: commissionSplitParts.otherBranchShareAmount,
          headOfficeOwnShareAmount: commissionSplitParts.headOfficeOwnShareAmount,
        };
      }
    }

    const completed = await this.transactionRepository.completePayment(tenantId, transactionId, {
      payoutPhotoUrl: payoutPhotoUrl || null,
      ...(commissionSplitSnapshot && { commissionSplit: commissionSplitSnapshot }),
    }, userId);
    if (!completed) throw new BusinessRuleError('Transaction already completed');

    // Extra mode: debit the full amount (what was physically paid to receiver) but only clear
    // the finalAmount that was committed at approval — hence committedPayoutAmount override.
    const payoutDebitAmount = useExtraMode ? completed.amount : completed.finalAmount;
    const payoutDesc = useExtraMode
      ? `Paid ₹${completed.amount} to receiver — Token ${completed.tokenNumber}`
      : `Paid ₹${completed.finalAmount} to receiver (₹${completed.commissionAmount} commission deducted) — Token ${completed.tokenNumber}`;

    await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
      transactionId: completed._id,
      type: 'debit',
      amount: payoutDebitAmount,
      description: payoutDesc,
      event: 'payout_completed',
      tokenNumber: completed.tokenNumber,
      ...(useExtraMode && { committedPayoutAmount: completed.finalAmount }),
    });

    // Receiver-side partner (Lenar) — the payout branch delivers cash TO this partner/receiver,
    // so the partner's balance INCREASES (they received money from the branch).
    if (completed.payoutExternalAccountId && completed.finalAmount > 0) {
      const payoutPartner = await ExternalAccountModel.findOne({ _id: completed.payoutExternalAccountId, tenantId });
      if (payoutPartner) {
        const pytBranchIdStr = completed.payoutBranchId.toString();
        const branchBalBefore = (payoutPartner.balances as any)?.get?.(pytBranchIdStr)
          ?? (payoutPartner.balances as any)?.[pytBranchIdStr]
          ?? payoutPartner.balance;
        const balBefore = branchBalBefore;
        const balAfter = balBefore + completed.finalAmount;
        await ExternalLedgerModel.create({
          tenantId,
          externalAccountId: payoutPartner._id,
          transactionId: completed._id,
          branchId: completed.payoutBranchId,
          type: 'deposit',
          direction: 'credit',
          amount: completed.finalAmount,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          description: `Token ${completed.tokenNumber} — received ₹${completed.finalAmount}`,
          entryDate: todayIST(),
          createdBy: userId,
          createdByName: actorName || null,
        });
        const pytBranchId = completed.payoutBranchId.toString();
        await ExternalAccountModel.updateOne(
          { _id: payoutPartner._id, tenantId },
          { $inc: { balance: completed.finalAmount, [`balances.${pytBranchId}`]: completed.finalAmount } },
        );
      }
    }

    // Fetch branches once — needed for commission descriptions, CommissionPayable record, and audit
    const [collectionBranch, payoutBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, completed.collectionBranchId.toString()),
      this.branchRepository.findById(tenantId, completed.payoutBranchId.toString()),
    ]);

    // Commission routing — mode-based (overrides all flags):
    //   Extra mode: MUM earned it by collecting cash from receiver on-site → credit payout branch
    //   Deduct mode: AHM earned it by setting a lower payout commitment → credit collection branch
    if (isPayoutSide && completed.commissionAmount > 0) {
      if (useExtraMode) {
        // Extra mode: payout branch (MUM) earns commission
        if (tenant?.businessType === 'enterprise' && commissionSplitParts) {
          await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
            transactionId: completed._id,
            type: 'credit',
            amount: completed.commissionAmount,
            description: `Commission ₹${completed.commissionAmount} collected from receiver — Token ${completed.tokenNumber}`,
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
        } else {
          await this.branchLedgerRepository.addEntry(tenantId, completed.payoutBranchId.toString(), {
            transactionId: completed._id,
            type: 'credit',
            amount: completed.commissionAmount,
            description: `Commission ₹${completed.commissionAmount} collected from receiver — Token ${completed.tokenNumber}`,
            event: 'commission_earned',
            tokenNumber: completed.tokenNumber,
          });
          // Legacy HQ item for non-enterprise
          const hqSharePct: number = (payoutBranch?.masterCommissionPct ?? 0);
          if (hqSharePct > 0) {
            this.hqCommissionItemRepository.create({
              tenantId,
              branchId: payoutBranch._id,
              branchName: payoutBranch.name as string,
              branchCode: payoutBranch.code as string,
              transactionId: completed._id,
              tokenNumber: completed.tokenNumber,
              commissionAmount: completed.commissionAmount,
              hqSharePct,
              hqShareAmount: Math.round(completed.commissionAmount * hqSharePct / 100),
            }).catch(() => {});
          }
        }
      } else {
        // Deduct mode: collection branch (AHM) earns commission
        await this.branchLedgerRepository.addEntry(tenantId, completed.collectionBranchId.toString(), {
          transactionId: completed._id,
          type: 'credit',
          amount: completed.commissionAmount,
          description: `Commission ₹${completed.commissionAmount} earned (deducted from receiver payout) — Token ${completed.tokenNumber}`,
          event: 'commission_earned',
          tokenNumber: completed.tokenNumber,
        });
        // HO commission item — collection branch is the earner
        if (tenant?.businessType === 'enterprise' && commissionSplitParts) {
          this.hqCommissionItemRepository.create({
            tenantId,
            branchId: completed.collectionBranchId,
            branchName: collectionBranch?.name || '',
            branchCode: collectionBranch?.code || '',
            transactionId: completed._id,
            tokenNumber: completed.tokenNumber,
            commissionAmount: completed.commissionAmount,
            hqSharePct: commissionSplitParts.hqSharePct,
            hqShareAmount: commissionSplitParts.hqShareAmount,
            otherBranchId: completed.payoutBranchId,
            otherBranchName: payoutBranch?.name || '',
            otherBranchCode: payoutBranch?.code || '',
            otherBranchShareAmount: commissionSplitParts.otherBranchShareAmount,
            headOfficeOwnShareAmount: commissionSplitParts.headOfficeOwnShareAmount,
          }).catch(() => {});
        } else if (tenant?.businessType !== 'enterprise') {
          const hqSharePct: number = (collectionBranch?.masterCommissionPct ?? 0);
          if (hqSharePct > 0) {
            this.hqCommissionItemRepository.create({
              tenantId,
              branchId: collectionBranch._id,
              branchName: collectionBranch.name as string,
              branchCode: collectionBranch.code as string,
              transactionId: completed._id,
              tokenNumber: completed.tokenNumber,
              commissionAmount: completed.commissionAmount,
              hqSharePct,
              hqShareAmount: Math.round(completed.commissionAmount * hqSharePct / 100),
            }).catch(() => {});
          }
        }
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
