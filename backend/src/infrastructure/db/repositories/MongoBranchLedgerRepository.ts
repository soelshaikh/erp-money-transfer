import mongoose from 'mongoose';
import IBranchLedgerRepository from '../../../application/ports/IBranchLedgerRepository';
import BranchLedgerModel from '../models/BranchLedger.model';
import BranchModel from '../models/Branch.model';
import BranchDailyBalanceModel from '../models/BranchDailyBalance.model';
import { NotFoundError } from '../../../domain/errors';
import { todayIST } from '../../../utils/dateIST';

/**
 * Determines which branch fields to increment based on the ledger event.
 *
 * collection              → balance +amount            (cash received)
 * collection_reversed     → balance -amount            (reversal on rejection)
 * pending_payout          → pendingPayout +amount      (legacy — no longer written)
 * pending_payout_reversed → pendingPayout -amount      (legacy — no longer written)
 * payout_committed        → committedPayout +amount    (approved, not yet paid)
 * payout_completed        → balance -amount            (actual cash out)
 *                           committedPayout -amount    (clear the commitment)
 *                           payoutCompleted +amount    (offset so effective returns to 0)
 *
 * Effective balance formula: balance − committedPayout − pendingPayout + payoutCompleted
 */
function buildIncrement(event: string, amount: number): Record<string, number> {
  switch (event) {
    case 'collection':
      return { balance: amount };
    case 'collection_reversed':
      return { balance: -amount };
    case 'pending_payout':
      return { pendingPayout: amount };
    case 'pending_payout_reversed':
      return { pendingPayout: -amount };
    case 'payout_committed':
      return { committedPayout: amount };
    case 'payout_completed':
      return { balance: -amount, committedPayout: -amount, payoutCompleted: amount };
    case 'commission_earned':
      return { balance: amount };
    default:
      return {};
  }
}

export default class MongoBranchLedgerRepository extends IBranchLedgerRepository {
  async addEntry(tenantId: any, branchId: any, {
    transactionId, type, amount, description, event, tokenNumber,
  }: any) {
    const inc = buildIncrement(event, amount);

    // Atomic update — { new: false } returns the doc BEFORE the change
    const oldBranch = await BranchModel.findOneAndUpdate(
      { _id: branchId, tenantId },
      { $inc: inc },
      { new: false }
    ).lean();

    if (!oldBranch) throw new NotFoundError('Branch');

    const prevBalance = (oldBranch as any).balance ?? 0;
    const prevCommitted = (oldBranch as any).committedPayout ?? 0;
    const prevPending = (oldBranch as any).pendingPayout ?? 0;
    const prevPayoutCompleted = (oldBranch as any).payoutCompleted ?? 0;

    const newBalance = prevBalance + (inc.balance ?? 0);
    const newCommitted = prevCommitted + (inc.committedPayout ?? 0);
    const newPending = prevPending + (inc.pendingPayout ?? 0);
    const newPayoutCompleted = prevPayoutCompleted + (inc.payoutCompleted ?? 0);

    const entry = await BranchLedgerModel.create({
      tenantId,
      branchId,
      transactionId,
      type,
      amount,
      actualBalanceBefore: prevBalance,
      actualBalanceAfter: newBalance,
      effectiveBalanceBefore: prevBalance - prevCommitted - prevPending + prevPayoutCompleted,
      effectiveBalanceAfter: newBalance - newCommitted - newPending + newPayoutCompleted,
      description,
      event,
      tokenNumber,
    });

    // Upsert daily balance snapshot — $setOnInsert only fires on first entry of the day
    const today = todayIST();
    BranchDailyBalanceModel.findOneAndUpdate(
      { tenantId, branchId, date: today },
      {
        $setOnInsert: { openingBalance: prevBalance },
        $set: { closingBalance: newBalance },
      },
      { upsert: true }
    ).catch(() => {});

    return { entry: entry.toObject() };
  }

  async findByBranch(tenantId: any, branchId: any, filters: any = {}) {
    const { page = 1, limit = 30, fromDate, toDate } = filters;
    const tId = new mongoose.Types.ObjectId(tenantId);
    const bId = new mongoose.Types.ObjectId(branchId);
    const query: any = { tenantId: tId, branchId: bId };

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (page - 1) * limit;
    const [data, total, stats] = await Promise.all([
      BranchLedgerModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BranchLedgerModel.countDocuments(query),
      BranchLedgerModel.aggregate([
        { $match: { tenantId: tId, branchId: bId } },
        {
          $group: {
            _id: null,
            totalCredits: { $sum: { $cond: [{ $eq: ['$event', 'collection'] }, '$amount', 0] } },
            totalDebits: { $sum: { $cond: [{ $eq: ['$event', 'payout_completed'] }, '$amount', 0] } },
            totalReversals: { $sum: { $cond: [{ $eq: ['$event', 'collection_reversed'] }, '$amount', 0] } },
          },
        },
      ]),
    ]);

    const summary = stats[0] || { totalCredits: 0, totalDebits: 0, totalReversals: 0 };

    return {
      data,
      total,
      page,
      limit,
      totalCredits: summary.totalCredits,
      totalDebits: summary.totalDebits,
      totalReversals: summary.totalReversals,
    };
  }

  async getOpeningBalanceForDate(tenantId: any, branchId: any, fromDate: string): Promise<number> {
    const record = await BranchDailyBalanceModel.findOne({
      tenantId,
      branchId,
      date: { $lt: fromDate },
    }).sort({ date: -1 }).lean();
    return (record as any)?.closingBalance ?? 0;
  }

  async getDailyBalances(tenantId: any, branchId: any, filters: any = {}) {
    const { page = 1, limit = 30, fromDate, toDate } = filters;
    const query: any = { tenantId, branchId };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      BranchDailyBalanceModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      BranchDailyBalanceModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }
}
