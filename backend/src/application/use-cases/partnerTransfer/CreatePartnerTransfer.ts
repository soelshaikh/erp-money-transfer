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

function calcCommission(side: string, type: string, value: number, amount: number): number {
  if (side === 'none' || value <= 0) return 0;
  return type === 'percentage' ? Math.round(amount * value / 100) : value;
}

export default class CreatePartnerTransfer {
  branchRepository: any;
  branchLedgerRepository: any;

  constructor(deps: any) {
    this.branchRepository = deps.branchRepository;
    this.branchLedgerRepository = deps.branchLedgerRepository;
  }

  async execute(params: any): Promise<any> {
    const {
      tenantId, externalAccountId, fromBranchId, toBranchId, amount, remarks,
      senderName, senderMobile, receiverName, receiverMobile, customerTokenNo,
      commissionSide, commissionType, commissionValue, paymentMethod,
      createdBy, createdByName, createdByRole,
    } = params;

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

    // Commission
    const effSide = commissionSide || 'none';
    const effType = commissionType || 'flat';
    const effValue = commissionValue || 0;
    const commissionAmount = calcCommission(effSide, effType, effValue, amount);

    // finalAmount = what TO branch's partner balance receives
    // 'payout' (Receiver Pays): FROM keeps difference, TO gets less
    // all others: TO gets full amount
    const finalAmount = effSide === 'payout' ? Math.max(0, amount - commissionAmount) : amount;

    // Partner balance at FROM — never block, allow negatives and overdraft
    const fromBal = (partner.balances as any)?.get?.(fromBranchIdStr) ?? (partner.balances as any)?.[fromBranchIdStr] ?? 0;
    const fromOnHold = (partner.onHolds as any)?.get?.(fromBranchIdStr) ?? (partner.onHolds as any)?.[fromBranchIdStr] ?? 0;
    const partnerAvailable = Math.max(0, fromBal - fromOnHold);
    const partnerCoversAmount = Math.min(amount, partnerAvailable);
    const branchCoversAmount = amount - partnerCoversAmount;
    const toBal = (partner.balances as any)?.get?.(toBranchIdStr) ?? (partner.balances as any)?.[toBranchIdStr] ?? 0;

    const transferRef = await generateRef(tenantId);
    const today = todayIST();

    const baseDoc: any = {
      tenantId, externalAccountId, fromBranchId, toBranchId,
      amount, finalAmount, partnerCoversAmount, branchCoversAmount,
      commissionSide: effSide, commissionType: effType,
      commissionValue: effValue, commissionAmount,
      paymentMethod: paymentMethod || 'cash',
      senderName: senderName?.trim() || null,
      senderMobile: senderMobile?.trim() || null,
      receiverName: receiverName?.trim() || null,
      receiverMobile: receiverMobile?.trim() || null,
      customerTokenNo: customerTokenNo?.trim() || null,
      remarks: remarks?.trim() || null,
      createdByRole: createdByRole === 'head_office' ? 'head_office' : 'branch',
      transferRef, createdBy, createdByName: createdByName || null,
    };

    // HO-created: immediate completion
    if (createdByRole === 'head_office') {
      const transfer = await PartnerTransferModel.create({
        ...baseDoc,
        status: 'completed',
        approvedBy: createdBy, approvedByName: createdByName || null,
        completedBy: createdBy, completedByName: createdByName || null,
        approvedAt: new Date(), completedAt: new Date(),
      });

      await Promise.all([
        ExternalLedgerModel.create({
          tenantId, externalAccountId: partner._id, branchId: fromBranchId,
          type: 'transfer_out', direction: 'debit', amount,
          balanceBefore: fromBal, balanceAfter: fromBal - amount,
          description: `Transfer to ${toBranch.name} — ${transferRef}`,
          entryDate: today, createdBy, createdByName: createdByName || null,
        }),
        ExternalLedgerModel.create({
          tenantId, externalAccountId: partner._id, branchId: toBranchId,
          type: 'transfer_in', direction: 'credit', amount: finalAmount,
          balanceBefore: toBal, balanceAfter: toBal + finalAmount,
          description: `Transfer from ${fromBranch.name} — ${transferRef}`,
          entryDate: today, createdBy, createdByName: createdByName || null,
        }),
        ExternalAccountModel.updateOne(
          { _id: partner._id, tenantId },
          { $inc: { [`balances.${fromBranchIdStr}`]: -amount, [`balances.${toBranchIdStr}`]: finalAmount } },
        ),
      ]);

      // Branch shortfall: FROM branch cash covers the gap (payout_completed with no prior committed)
      if (branchCoversAmount > 0) {
        await this.branchLedgerRepository.addEntry(tenantId, fromBranchId, {
          transactionId: null, type: 'debit', amount: branchCoversAmount,
          description: `Partner transfer branch coverage — ${transferRef}`,
          event: 'payout_completed', tokenNumber: null, committedPayoutAmount: 0,
        });
      }

      // Commission at completion (HO immediate)
      if (commissionAmount > 0) {
        if (effSide === 'collection') {
          // Sender pays: FROM branch earns commission
          await this.branchLedgerRepository.addEntry(tenantId, fromBranchId, {
            transactionId: null, type: 'credit', amount: commissionAmount,
            description: `Partner transfer commission — ${transferRef}`,
            event: 'partner_commission', tokenNumber: null,
          });
        } else if (effSide === 'payout') {
          // Receiver pays: FROM branch keeps the difference
          await this.branchLedgerRepository.addEntry(tenantId, fromBranchId, {
            transactionId: null, type: 'credit', amount: commissionAmount,
            description: `Partner transfer commission — ${transferRef}`,
            event: 'partner_commission', tokenNumber: null,
          });
        } else if (effSide === 'payout_extra') {
          // Receiver extra: TO branch earns commission
          await this.branchLedgerRepository.addEntry(tenantId, toBranchId, {
            transactionId: null, type: 'credit', amount: commissionAmount,
            description: `Partner transfer commission — ${transferRef}`,
            event: 'partner_commission', tokenNumber: null,
          });
        }
      }

      return transfer;
    }

    // Branch-created: pending + lock onHold for whatever partner can cover
    const [transfer] = await Promise.all([
      PartnerTransferModel.create({ ...baseDoc, status: 'pending' }),
      partnerCoversAmount > 0
        ? ExternalAccountModel.updateOne(
            { _id: partner._id, tenantId },
            { $inc: { [`onHolds.${fromBranchIdStr}`]: partnerCoversAmount } },
          )
        : Promise.resolve(),
    ]);

    // Branch shortfall: put branch cash on hold
    if (branchCoversAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, fromBranchId, {
        transactionId: null, type: 'committed_debit', amount: branchCoversAmount,
        description: `Partner transfer committed — ${transferRef}`,
        event: 'payout_committed', tokenNumber: null,
      });
    }

    // Sender pays: credit commission to FROM branch at create time
    if (effSide === 'collection' && commissionAmount > 0) {
      await this.branchLedgerRepository.addEntry(tenantId, fromBranchId, {
        transactionId: null, type: 'credit', amount: commissionAmount,
        description: `Partner transfer commission — ${transferRef}`,
        event: 'partner_commission', tokenNumber: null,
      });
    }

    return transfer;
  }
}
