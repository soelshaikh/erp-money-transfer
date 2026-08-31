import ExternalAccountModel from '../../../infrastructure/db/models/ExternalAccount.model';
import ExternalLedgerModel from '../../../infrastructure/db/models/ExternalLedger.model';
import PartnerTransferModel from '../../../infrastructure/db/models/PartnerTransfer.model';
import { ValidationError, NotFoundError } from '../../../domain/errors';
import { todayIST } from '../../../utils/dateIST';

async function generateRef(tenantId: string): Promise<string> {
  const d = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  const prefix = `PT-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-`;
  const count = await PartnerTransferModel.countDocuments({ tenantId, transferRef: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(5, '0')}`;
}

export default class CreatePartnerTransfer {
  branchRepository: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
  }

  async execute(params: any): Promise<any> {
    const { tenantId, externalAccountId, fromBranchId, toBranchId, amount, remarks, senderName, senderMobile, receiverName, receiverMobile, createdBy, createdByName, createdByRole } = params;

    if (!amount || amount <= 0) throw new ValidationError('Amount must be greater than zero');
    if (fromBranchId.toString() === toBranchId.toString()) throw new ValidationError('Source and destination branches must be different');

    const partner = await ExternalAccountModel.findOne({ _id: externalAccountId, tenantId, status: 'active' });
    if (!partner) throw new NotFoundError('Partner account not found or inactive');

    const [fromBranch, toBranch] = await Promise.all([
      this.branchRepository.findById(tenantId, fromBranchId),
      this.branchRepository.findById(tenantId, toBranchId),
    ]);
    if (!fromBranch || fromBranch.status !== 'active') throw new NotFoundError('Source branch not found or inactive');
    if (!toBranch || toBranch.status !== 'active') throw new NotFoundError('Destination branch not found or inactive');

    const fromBranchIdStr = fromBranchId.toString();
    const toBranchIdStr = toBranchId.toString();

    // HO-created: immediate completion, no approval needed
    if (createdByRole === 'head_office') {
      const branchBal = (partner.balances as any)?.get?.(fromBranchIdStr) ?? (partner.balances as any)?.[fromBranchIdStr] ?? 0;
      const branchOnHold = (partner.onHolds as any)?.get?.(fromBranchIdStr) ?? (partner.onHolds as any)?.[fromBranchIdStr] ?? 0;
      const available = Math.max(0, branchBal - branchOnHold);
      if (amount > available) {
        throw new ValidationError(`Insufficient available balance at source branch. Available: ${available}`);
      }

      const transferRef = await generateRef(tenantId);
      const today = todayIST();

      // Compute branch-specific balances before for ledger entries
      const fromBalBefore = (partner.balances as any)?.get?.(fromBranchIdStr) ?? (partner.balances as any)?.[fromBranchIdStr] ?? 0;
      const toBalBefore = (partner.balances as any)?.get?.(toBranchIdStr) ?? (partner.balances as any)?.[toBranchIdStr] ?? 0;

      const transfer = await PartnerTransferModel.create({
        tenantId,
        externalAccountId,
        fromBranchId,
        toBranchId,
        amount,
        status: 'completed',
        remarks: remarks?.trim() || null,
        createdByRole: 'head_office',
        transferRef,
        createdBy,
        createdByName: createdByName || null,
        approvedBy: createdBy,
        approvedByName: createdByName || null,
        completedBy: createdBy,
        completedByName: createdByName || null,
        approvedAt: new Date(),
        completedAt: new Date(),
      });

      await Promise.all([
        ExternalLedgerModel.create({
          tenantId,
          externalAccountId,
          branchId: fromBranchId,
          type: 'transfer_out',
          direction: 'debit',
          amount,
          balanceBefore: fromBalBefore,
          balanceAfter: fromBalBefore - amount,
          description: `Transfer to ${toBranch.name} — ${transferRef}`,
          entryDate: today,
          createdBy,
          createdByName: createdByName || null,
        }),
        ExternalLedgerModel.create({
          tenantId,
          externalAccountId,
          branchId: toBranchId,
          type: 'transfer_in',
          direction: 'credit',
          amount,
          balanceBefore: toBalBefore,
          balanceAfter: toBalBefore + amount,
          description: `Transfer from ${fromBranch.name} — ${transferRef}`,
          entryDate: today,
          createdBy,
          createdByName: createdByName || null,
        }),
        ExternalAccountModel.updateOne(
          { _id: partner._id, tenantId },
          { $inc: { [`balances.${fromBranchIdStr}`]: -amount, [`balances.${toBranchIdStr}`]: amount } },
        ),
      ]);

      return transfer;
    }

    // Branch-created: pending + lock onHold
    const branchBal = (partner.balances as any)?.get?.(fromBranchIdStr) ?? (partner.balances as any)?.[fromBranchIdStr] ?? 0;
    const branchOnHold = (partner.onHolds as any)?.get?.(fromBranchIdStr) ?? (partner.onHolds as any)?.[fromBranchIdStr] ?? 0;
    const available = Math.max(0, branchBal - branchOnHold);
    if (amount > available) {
      throw new ValidationError(`Insufficient available balance at source branch. Available: ${available}`);
    }

    const transferRef = await generateRef(tenantId);

    const [transfer] = await Promise.all([
      PartnerTransferModel.create({
        tenantId,
        externalAccountId,
        fromBranchId,
        toBranchId,
        amount,
        status: 'pending',
        remarks: remarks?.trim() || null,
        createdByRole: 'branch',
        transferRef,
        createdBy,
        createdByName: createdByName || null,
      }),
      ExternalAccountModel.updateOne(
        { _id: partner._id, tenantId },
        { $inc: { [`onHolds.${fromBranchIdStr}`]: amount } },
      ),
    ]);

    return transfer;
  }
}
