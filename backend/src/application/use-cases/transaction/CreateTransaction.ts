import Commission from '../../../domain/value-objects/Commission';
import TokenNumber from '../../../domain/value-objects/TokenNumber';
import { AUDIT_ACTIONS, COMMISSION_SIDE, COMMISSION_TYPE, MODULES, NOTIFICATION_TYPE, ROLES } from '../../../config/constants';
import { NotFoundError, BusinessRuleError, ValidationError } from '../../../domain/errors';
import logger from '../../../config/logger';
import { todayIST } from '../../../utils/dateIST';
import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';

export default class CreateTransaction {
  transactionRepository: any;
  branchRepository: any;
  tenantRepository: any;
  notificationService: any;
  auditService: any;
  branchLedgerRepository: any;
  commissionPayableRepository: any;

  constructor(deps: any) {
    this.transactionRepository = deps.transactionRepository;
    this.branchRepository = deps.branchRepository;
    this.tenantRepository = deps.tenantRepository;
    this.notificationService = deps.notificationService;
    this.auditService = deps.auditService;
    this.branchLedgerRepository = deps.branchLedgerRepository;
    this.commissionPayableRepository = deps.commissionPayableRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, collectionBranchId, payoutBranchId, amount, remarks, paymentMethod, collectionPhotoUrl, customerTokenNo, createdBy, actorName, actorUsername, externalAccountId } = params;
    const validSides = Object.values(COMMISSION_SIDE) as string[];
    const commissionSide: string = validSides.includes(params.commissionSide) ? params.commissionSide : COMMISSION_SIDE.COLLECTION;

    logger.info({ tenantId, collectionBranchId, payoutBranchId, amount, commissionSide }, '[TXN:UC] execute started — fetching tenant + branches');

    const [tenant, collectionBranch, payoutBranch] = await Promise.all([
      this.tenantRepository.findById(tenantId),
      this.branchRepository.findById(tenantId, collectionBranchId),
      this.branchRepository.findById(tenantId, payoutBranchId),
    ]);

    logger.info(
      {
        tenantFound: !!tenant,
        collectionBranchFound: !!collectionBranch,
        collectionBranchStatus: collectionBranch?.status,
        payoutBranchFound: !!payoutBranch,
        payoutBranchStatus: payoutBranch?.status,
      },
      '[TXN:UC] tenant + branch lookup complete',
    );

    if (!tenant) throw new NotFoundError('Tenant');
    if (!collectionBranch || collectionBranch.status !== 'active') throw new NotFoundError('Collection branch');
    if (!payoutBranch || payoutBranch.status !== 'active') throw new NotFoundError('Payout branch');

    // --- Transaction limit enforcement ---
    const limits = tenant.settings?.transactionLimits;

    logger.info(
      { maxAmountPerTransaction: limits?.maxAmountPerTransaction || 0, dailyLimitPerBranch: limits?.dailyLimitPerBranch || 0, amount },
      '[TXN:UC] checking transaction limits',
    );

    // Check max amount per transaction
    if (limits?.maxAmountPerTransaction > 0 && amount > limits.maxAmountPerTransaction) {
      logger.warn({ amount, maxAmountPerTransaction: limits.maxAmountPerTransaction }, '[TXN:UC] limit BLOCKED — exceeds max per transaction');
      throw new BusinessRuleError(
        `Transaction amount ₹${amount.toLocaleString('en-IN')} exceeds the maximum allowed ₹${limits.maxAmountPerTransaction.toLocaleString('en-IN')} per transaction`
      );
    }

    // Check daily branch limit
    if (limits?.dailyLimitPerBranch > 0) {
      const todayTotal = await this.transactionRepository.sumTodayByBranch(tenantId, collectionBranchId);
      logger.info({ todayTotal, amount, dailyLimitPerBranch: limits.dailyLimitPerBranch, remaining: limits.dailyLimitPerBranch - todayTotal }, '[TXN:UC] daily limit check');
      if (todayTotal + amount > limits.dailyLimitPerBranch) {
        const remaining = Math.max(0, limits.dailyLimitPerBranch - todayTotal);
        logger.warn({ todayTotal, amount, dailyLimitPerBranch: limits.dailyLimitPerBranch, remaining }, '[TXN:UC] limit BLOCKED — daily limit reached');
        throw new BusinessRuleError(
          `Daily limit reached. Remaining capacity: ₹${remaining.toLocaleString('en-IN')}`
        );
      }
    }

    // Determine what the commission would be WITHOUT any override (needed for override audit)
    // Commission config is read from the branch that earns it: payout branch when commissionSide=payout, collection branch otherwise
    const globalCommission = tenant.settings?.commission || {};
    const sourceBranch = (commissionSide === COMMISSION_SIDE.PAYOUT || commissionSide === COMMISSION_SIDE.PAYOUT_EXTRA) ? payoutBranch : collectionBranch;
    const originalType: string = sourceBranch.commissionConfig?.enabled
      ? (sourceBranch.commissionConfig.type || COMMISSION_TYPE.FLAT)
      : (globalCommission.type || COMMISSION_TYPE.FLAT);
    const originalValue: number = sourceBranch.commissionConfig?.enabled
      ? (sourceBranch.commissionConfig.value ?? 0)
      : (globalCommission.value ?? 0);

    // Commission priority: runtime override (if permitted) → branch config → global tenant setting
    const { commissionOverride, canOverrideCommission } = params;
    const commissionType: string = (commissionOverride && canOverrideCommission) ? commissionOverride.type : originalType;
    const commissionValue: number = (commissionOverride && canOverrideCommission) ? commissionOverride.value : originalValue;

    const { commissionAmount } = Commission.calculate(amount, commissionType, commissionValue);
    // collection side: sender pays commission on top → receiver gets full amount
    // payout side: commission cut from amount → receiver gets amount − commission
    const finalAmount = commissionSide === COMMISSION_SIDE.PAYOUT ? amount - commissionAmount : amount;

    logger.info(
      {
        commissionSource: sourceBranch.commissionConfig?.enabled ? 'branch-config' : 'global',
        originalType,
        originalValue,
        commissionType,
        commissionValue,
        commissionAmount,
        finalAmount,
        isOverride: !!(commissionOverride && canOverrideCommission),
      },
      '[TXN:UC] commission calculated',
    );

    // --- Partner (ExternalAccount) validation and onHold ---
    let partnerCoveredAmount = 0;
    let partner: any = null;

    if (externalAccountId) {
      partner = await ExternalAccountModel.findOne({ _id: externalAccountId, tenantId, branchId: collectionBranchId, status: 'active' });
      if (!partner) throw new ValidationError('Partner account not found or not linked to this branch');

      const availableBalance = partner.balance - partner.onHold;
      partnerCoveredAmount = Math.max(0, Math.min(amount, availableBalance));

      // Lock partner balance portion for this pending transaction
      await ExternalAccountModel.updateOne(
        { _id: partner._id, tenantId },
        { $inc: { onHold: partnerCoveredAmount } },
      );

      logger.info({ externalAccountId, availableBalance, partnerCoveredAmount }, '[TXN:UC] partner on-hold locked');
    }

    const now = new Date();
    const dateStr = todayIST();
    const sequence = await this.transactionRepository.getDailySequence(tenantId, collectionBranch.code, dateStr);
    const tokenNumber = TokenNumber.generate(collectionBranch.code, sequence);

    logger.info({ tokenNumber, sequence, dateStr }, '[TXN:UC] token number generated — saving transaction');

    const transaction = await this.transactionRepository.create({
      tenantId,
      tokenNumber,
      collectionBranchId,
      payoutBranchId,
      amount,
      commissionType,
      commissionValue,
      commissionAmount,
      commissionSide,
      finalAmount,
      remarks,
      paymentMethod: paymentMethod || 'cash',
      collectionPhotoUrl: collectionPhotoUrl || null,
      customerTokenNo: customerTokenNo || null,
      createdBy,
      externalAccountId: externalAccountId || null,
      partnerCoveredAmount,
    });

    logger.info({ transactionId: transaction._id, tokenNumber }, '[TXN:UC] transaction saved to DB');

    // Credit collection branch with the amount NOT covered by partner:
    // collection side → (amount − partnerCovered) + commission
    // payout side → amount − partnerCovered
    const branchPortion = amount - partnerCoveredAmount;
    const collectionCredit = commissionSide === COMMISSION_SIDE.COLLECTION ? branchPortion + commissionAmount : branchPortion;

    logger.info({ collectionBranchId, collectionCredit, branchPortion, partnerCoveredAmount, commissionSide }, '[TXN:UC] crediting collection branch ledger');

    if (collectionCredit > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, collectionBranchId, {
        transactionId: transaction._id,
        type: 'credit',
        amount: collectionCredit,
        description: `Collected ${commissionSide === COMMISSION_SIDE.COLLECTION ? `₹${collectionCredit} (incl. ₹${commissionAmount} commission)` : `₹${branchPortion}`} → Payout to ${payoutBranch.name}${partner ? ` [Partner: ${partner.name}]` : ''}`,
        event: 'collection',
        tokenNumber,
      });
    }

    // If creditCommissionToSendingBranch is ON and receiver pays, track commission lifecycle from creation
    const isPayoutSide = commissionSide === COMMISSION_SIDE.PAYOUT || commissionSide === COMMISSION_SIDE.PAYOUT_EXTRA;
    if (isPayoutSide && commissionAmount > 0 && tenant.features?.creditCommissionToSendingBranch === true) {
      this.commissionPayableRepository.create({
        tenantId,
        fromBranchId: payoutBranchId,
        fromBranchName: payoutBranch.name,
        fromBranchCode: payoutBranch.code,
        toBranchId: collectionBranchId,
        toBranchName: collectionBranch.name,
        toBranchCode: collectionBranch.code,
        transactionId: transaction._id,
        tokenNumber,
        amount: commissionAmount,
        status: 'expected',
      }).catch(() => {});
    }

    logger.info({ transactionId: transaction._id, tokenNumber }, '[TXN:UC] ledger credited — dispatching notification to head_office');

    this.notificationService.notifyRole(tenantId, ROLES.HEAD_OFFICE, {
      type: NOTIFICATION_TYPE.TRANSACTION_CREATED,
      title: 'New Transaction',
      body: `Token ${tokenNumber} — ₹${amount} requires approval`,
      data: { transactionId: transaction._id, tokenNumber },
    }).catch(() => {});

    this.auditService.log({
      tenantId,
      userId: createdBy,
      actorName,
      actorUsername,
      action: AUDIT_ACTIONS.CREATE,
      module: MODULES.TRANSACTION,
      entityId: transaction._id.toString(),
      after: {
        tokenNumber, amount, commissionType, commissionValue, commissionAmount, commissionSide, finalAmount, paymentMethod,
        collectionBranchName: collectionBranch.name,
        collectionBranchCode: collectionBranch.code,
        payoutBranchName: payoutBranch.name,
        payoutBranchCode: payoutBranch.code,
      },
    });

    // Log commission override separately so it is queryable as its own event
    if (commissionOverride && canOverrideCommission) {
      const { commissionAmount: originalCommissionAmount } = Commission.calculate(amount, originalType, originalValue);
      this.auditService.log({
        tenantId,
        userId: createdBy,
        actorName,
        actorUsername,
        action: AUDIT_ACTIONS.COMMISSION_OVERRIDE,
        module: MODULES.TRANSACTION,
        entityId: transaction._id.toString(),
        before: { type: originalType, value: originalValue, amount: originalCommissionAmount },
        after: { type: commissionType, value: commissionValue, amount: commissionAmount, tokenNumber },
      });
    }

    logger.info({ transactionId: transaction._id, tokenNumber }, '[TXN:UC] execute complete');
    return transaction;
  }
}
