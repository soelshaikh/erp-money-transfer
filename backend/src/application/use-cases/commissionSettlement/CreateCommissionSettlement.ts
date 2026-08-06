import { NotFoundError, BusinessRuleError } from '../../../domain/errors';

export default class CreateCommissionSettlement {
  commissionPayableRepository: any;
  commissionSettlementRepository: any;
  branchRepository: any;

  constructor(deps: any) {
    this.commissionPayableRepository = deps.commissionPayableRepository;
    this.commissionSettlementRepository = deps.commissionSettlementRepository;
    this.branchRepository = deps.branchRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, fromBranchId, toBranchId, notes, initiatedBy, initiatedByName } = params;

    const [fromBranch, toBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, fromBranchId),
      this.branchRepository.findById(tenantId, toBranchId),
    ]);
    if (!fromBranch) throw new NotFoundError('Payout branch');
    if (!toBranch) throw new NotFoundError('Collection branch');

    // Get all pending (unreserved) commission payables between these two branches
    const pendingPayables = await this.commissionPayableRepository.findPending(tenantId, fromBranchId, toBranchId);
    if (!pendingPayables.length) {
      throw new BusinessRuleError('No pending commission payables found between these branches');
    }

    const totalAmount = pendingPayables.reduce((sum: number, p: any) => sum + p.amount, 0);
    const payableIds = pendingPayables.map((p: any) => p._id.toString());

    const settlement = await this.commissionSettlementRepository.create({
      tenantId,
      fromBranchId,
      fromBranchName: fromBranch.name,
      fromBranchCode: fromBranch.code,
      toBranchId,
      toBranchName: toBranch.name,
      toBranchCode: toBranch.code,
      totalAmount,
      transactionCount: pendingPayables.length,
      status: 'pending',
      payableIds,
      initiatedBy,
      initiatedByName,
      initiatedAt: new Date(),
      notes: notes || null,
    });

    // Reserve all payables so they cannot be included in another settlement simultaneously
    await this.commissionPayableRepository.reserveForSettlement(tenantId, payableIds, settlement._id.toString());

    return settlement;
  }
}
