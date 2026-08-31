import logger from '../../../config/logger';

export default class TransactionController {
  private createTransaction: any;
  private approveTransaction: any;
  private rejectTransaction: any;
  private completePayment: any;
  private getTransactions: any;
  private getTransaction: any;
  private transactionRepository: any;
  private branchLedgerRepository: any;

  constructor({ createTransaction, approveTransaction, rejectTransaction, completePayment, getTransactions, getTransaction, transactionRepository, branchLedgerRepository }: any) {
    this.createTransaction = createTransaction;
    this.approveTransaction = approveTransaction;
    this.rejectTransaction = rejectTransaction;
    this.completePayment = completePayment;
    this.getTransactions = getTransactions;
    this.getTransaction = getTransaction;
    this.transactionRepository = transactionRepository;
    this.branchLedgerRepository = branchLedgerRepository;
    this.create = this.create.bind(this);
    this.approve = this.approve.bind(this);
    this.reject = this.reject.bind(this);
    this.complete = this.complete.bind(this);
    this.list = this.list.bind(this);
    this.getOne = this.getOne.bind(this);
    this.ledgerTrail = this.ledgerTrail.bind(this);
    this.commissionSummary = this.commissionSummary.bind(this);
    this.commissionDetail = this.commissionDetail.bind(this);
  }

  async create(req: any, res: any) {
    const { collectionBranchId, payoutBranchId, amount, paymentMethod, commissionSide, customerTokenNo } = req.body;
    logger.info(
      {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        username: req.user.username,
        collectionBranchId,
        payoutBranchId,
        amount,
        paymentMethod,
        commissionSide,
        customerTokenNo: customerTokenNo || null,
        hasCollectionPhoto: !!req.body.collectionPhotoUrl,
        hasCommissionOverride: !!req.body.commissionOverride,
      },
      '[TXN] create request received',
    );

    const tx = await this.createTransaction.execute({
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
      actorName: req.user.name,
      actorUsername: req.user.username,
      canOverrideCommission: req.user.permissions?.canOverrideCommission || false,
    });

    logger.info(
      { tenantId: req.user.tenantId, transactionId: tx._id, tokenNumber: tx.tokenNumber, amount: tx.amount },
      '[TXN] create success',
    );
    res.status(201).json({ success: true, data: tx });
  }

  async approve(req: any, res: any) {
    const tx = await this.approveTransaction.execute({
      tenantId: req.user.tenantId, transactionId: req.params.id, userId: req.user.id,
      actorName: req.user.name, actorUsername: req.user.username,
    });
    res.json({ success: true, data: tx });
  }

  async reject(req: any, res: any) {
    const tx = await this.rejectTransaction.execute({
      tenantId: req.user.tenantId, transactionId: req.params.id, userId: req.user.id,
      remarks: req.body.remarks,
      actorName: req.user.name, actorUsername: req.user.username,
    });
    res.json({ success: true, data: tx });
  }

  async complete(req: any, res: any) {
    const tx = await this.completePayment.execute({
      tenantId: req.user.tenantId,
      transactionId: req.params.id,
      userId: req.user.id,
      payoutPhotoUrl: req.body.payoutPhotoUrl || null,
      commissionDeducted: req.body.commissionDeducted === true,
      actorName: req.user.name,
      actorUsername: req.user.username,
    });
    res.json({ success: true, data: tx });
  }

  async list(req: any, res: any) {
    const { approvalStatus, paymentStatus, branchId, branchRole, fromDate, toDate, tokenNumber, minAmount, maxAmount, page, limit } = req.query;
    // Branch users always see only their own branch's transactions
    const effectiveBranchId = req.user.role === 'branch' ? req.user.branchId : (branchId || undefined);
    const result = await this.getTransactions.execute({
      tenantId: req.user.tenantId,
      filters: { approvalStatus, paymentStatus, branchId: effectiveBranchId, branchRole, fromDate, toDate, tokenNumber, minAmount, maxAmount, page: Number(page) || 1, limit: Number(limit) || 20 },
    });
    res.json({ success: true, data: result });
  }

  async getOne(req: any, res: any) {
    const tx = await this.getTransaction.execute({ tenantId: req.user.tenantId, transactionId: req.params.id });
    res.json({ success: true, data: tx });
  }

  async ledgerTrail(req: any, res: any) {
    const entries = await this.branchLedgerRepository.findByTransaction(req.user.tenantId, req.params.id);
    res.json({ success: true, data: entries });
  }

  async commissionSummary(req: any, res: any) {
    const { fromDate, toDate } = req.query;
    // Branch: their own branch (may earn as collection OR payout branch)
    const branchId = req.user.role === 'branch' ? req.user.branchId : undefined;
    const result = await this.transactionRepository.getCommissionSummary(req.user.tenantId, {
      branchId,
      fromDate: fromDate || null,
      toDate: toDate || null,
    });
    res.json({ success: true, data: result });
  }

  async commissionDetail(req: any, res: any) {
    const { branchId, fromDate, toDate, page, limit } = req.query;
    // Branch: force their own branchId; head office: optional branchId filter
    const effectiveBranchId = req.user.role === 'branch' ? req.user.branchId : (branchId || undefined);
    const result = await this.transactionRepository.getCommissionDetail(req.user.tenantId, {
      branchId: effectiveBranchId,
      fromDate: fromDate || null,
      toDate: toDate || null,
      page: Number(page) || 1,
      limit: Number(limit) || 30,
    });
    res.json({ success: true, data: result });
  }
}
