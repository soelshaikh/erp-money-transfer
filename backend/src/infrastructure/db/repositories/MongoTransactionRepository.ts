import mongoose from 'mongoose';
import ITransactionRepository from '../../../application/ports/ITransactionRepository';
import TransactionModel from '../models/Transaction.model';
import { CounterModel } from '../models/Counter.model';
import { NotFoundError } from '../../../domain/errors';
import { APPROVAL_STATUS, PAYMENT_STATUS } from '../../../config/constants';
import { todayIST, parseISTFilterDate, istStartOfDay, istEndOfDay } from '../../../utils/dateIST';

export default class MongoTransactionRepository extends ITransactionRepository {
  async create(data: any) {
    const doc = await TransactionModel.create(data);
    return doc.toObject();
  }

  async findById(tenantId: any, id: any) {
    const doc = await TransactionModel.findOne({ _id: id, tenantId })
      .populate('collectionBranchId', 'name code')
      .populate('payoutBranchId', 'name code')
      .populate('createdBy', 'name username')
      .populate('approvedBy', 'name username')
      .populate('completedBy', 'name username')
      .populate('externalAccountId', 'name code')
      .lean();
    return doc || null;
  }

  async findByTokenNumber(tenantId: any, tokenNumber: any) {
    const doc = await TransactionModel.findOne({ tenantId, tokenNumber }).lean();
    return doc || null;
  }

  /**
   * Atomic approve using findOneAndUpdate with approvalStatus pre-condition.
   * Prevents dual-approval race condition.
   */
  async approveAtomic(tenantId: any, id: any, userId: any) {
    const doc = await TransactionModel.findOneAndUpdate(
      { _id: id, tenantId, approvalStatus: APPROVAL_STATUS.PENDING },
      {
        $set: {
          approvalStatus: APPROVAL_STATUS.APPROVED,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      },
      { new: true }
    ).lean();
    return doc || null; // null = already processed by another user
  }

  async rejectAtomic(tenantId: any, id: any, userId: any, remarks: any) {
    const doc = await TransactionModel.findOneAndUpdate(
      { _id: id, tenantId, approvalStatus: APPROVAL_STATUS.PENDING },
      {
        $set: {
          approvalStatus: APPROVAL_STATUS.REJECTED,
          approvedBy: userId,
          approvedAt: new Date(),
          remarks,
        },
      },
      { new: true }
    ).lean();
    return doc || null;
  }

  async completePayment(tenantId: any, id: any, extras: any = {}, completedBy?: any) {
    const doc = await TransactionModel.findOneAndUpdate(
      { _id: id, tenantId, paymentStatus: PAYMENT_STATUS.PENDING },
      { $set: { paymentStatus: PAYMENT_STATUS.COMPLETED, completedAt: new Date(), ...(completedBy && { completedBy }), ...extras } },
      { new: true }
    ).lean();
    return doc || null; // null = already completed by a concurrent request
  }

  async findAll(tenantId: any, filters: any = {}) {
    const { branchId, branchRole, approvalStatus, paymentStatus, fromDate, toDate, page = 1, limit = 20 } = filters;
    const query: any = { tenantId };
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (branchId) {
      if (branchRole === 'payout') query.payoutBranchId = branchId;
      else if (branchRole === 'collection') query.collectionBranchId = branchId;
      else query.$or = [
        { collectionBranchId: branchId },
        { payoutBranchId: branchId, approvalStatus: { $ne: 'pending' } },
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = parseISTFilterDate(fromDate, false);
      if (toDate)   query.createdAt.$lte = parseISTFilterDate(toDate, true);
    }
    if (filters.tokenNumber) {
      query.tokenNumber = { $regex: filters.tokenNumber, $options: 'i' };
    }
    if (filters.minAmount !== undefined && filters.minAmount !== null && filters.minAmount !== '') {
      query.amount = { ...(query.amount || {}), $gte: Number(filters.minAmount) };
    }
    if (filters.maxAmount !== undefined && filters.maxAmount !== null && filters.maxAmount !== '') {
      query.amount = { ...(query.amount || {}), $lte: Number(filters.maxAmount) };
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TransactionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('collectionBranchId', 'name code')
        .populate('payoutBranchId', 'name code')
        .lean(),
      TransactionModel.countDocuments(query),
    ]);
    return { data, total, page, limit };
  }

  async getDailySequence(tenantId: any, branchCode: any, dateStr: any) {
    // Normalize date to YYYYMMDD so the counter key is always consistent
    // regardless of whether the caller passes "2026-07-31" or "20260731"
    const datePart = String(dateStr).replace(/-/g, '');
    const key = `${tenantId}-${branchCode}-${datePart}`;

    // Self-heal: if the counter document is behind the actual DB state (e.g. after
    // manual data migration), advance it to at least existingCount.
    // This step can tolerate a race condition because correctness comes from $inc below.
    const existingCount = await TransactionModel.countDocuments({
      tenantId,
      tokenNumber: { $regex: `^${branchCode}-${datePart}-` },
    });
    await CounterModel.updateOne(
      { key },
      [{ $set: { seq: { $max: ['$seq', existingCount] } } }],
      { upsert: true },
    );

    // Atomic $inc is the only correct way to generate unique sequences under
    // concurrent requests — aggregation-pipeline upserts can return the same value
    // when two requests race on a non-existent document.
    const counter = await CounterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true },
    );
    return counter!.seq;
  }

  async getDashboardStats(tenantId: any, filters: any = {}) {
    const { branchId, branchRole, fromDate, toDate } = filters;
    const tId = new mongoose.Types.ObjectId(tenantId);
    const matchStage: any = { tenantId: tId };
    if (branchId) {
      const bId = new mongoose.Types.ObjectId(branchId);
      if (branchRole === 'payout') matchStage.payoutBranchId = bId;
      else if (branchRole === 'collection') matchStage.collectionBranchId = bId;
      else matchStage.$or = [{ collectionBranchId: bId }, { payoutBranchId: bId }];
    }
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate) matchStage.createdAt.$gte = parseISTFilterDate(fromDate, false);
      if (toDate)   matchStage.createdAt.$lte = parseISTFilterDate(toDate, true);
    }

    const [stats] = await TransactionModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$commissionAmount' },
          pendingCount: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0] } },
          completedCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0] } },
        },
      },
    ]);

    return stats || {
      totalTransactions: 0,
      totalAmount: 0,
      totalCommission: 0,
      pendingCount: 0,
      approvedCount: 0,
      completedCount: 0,
    };
  }

  async getCommissionSummary(tenantId: any, filters: any = {}) {
    const { branchId, fromDate, toDate } = filters;
    const match: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (branchId) {
      const bId = new mongoose.Types.ObjectId(branchId);
      // Pre-filter: include any transaction where this branch is collection OR payout
      // The earningBranchId stage below further narrows to transactions they actually earned
      match.$or = [{ collectionBranchId: bId }, { payoutBranchId: bId }];
    }
    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) match.createdAt.$gte = parseISTFilterDate(fromDate, false);
      if (toDate)   match.createdAt.$lte = parseISTFilterDate(toDate, true);
    }

    // earningBranchId: use commissionSplit.earningBranchId when saved (set at payout completion).
    // For pending/approved payout-side txns, default to collectionBranchId (deduct is the default mode).
    const earningBranchExpr: any = { $ifNull: ['$commissionSplit.earningBranchId', '$collectionBranchId'] };
    const earningBranchFilter = branchId ? [{ $match: { earningBranchId: new mongoose.Types.ObjectId(branchId) } }] : [];

    const [rows, grand] = await Promise.all([
      TransactionModel.aggregate([
        { $match: match },
        { $addFields: { earningBranchId: earningBranchExpr } },
        ...earningBranchFilter,
        { $group: { _id: '$earningBranchId', totalCommission: { $sum: '$commissionAmount' }, totalAmount: { $sum: '$amount' }, txnCount: { $sum: 1 } } },
        { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
        { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, branchId: '$_id', branchName: '$branch.name', branchCode: '$branch.code', branchType: '$branch.type', totalCommission: 1, totalAmount: 1, txnCount: 1 } },
        { $sort: { totalCommission: -1 } },
      ]),
      TransactionModel.aggregate([
        { $match: match },
        { $addFields: { earningBranchId: earningBranchExpr } },
        ...earningBranchFilter,
        { $group: { _id: null, totalCommission: { $sum: '$commissionAmount' }, totalAmount: { $sum: '$amount' }, txnCount: { $sum: 1 } } },
      ]),
    ]);

    const g = grand[0] || { totalCommission: 0, totalAmount: 0, txnCount: 0 };
    return { branches: rows, grandTotal: { totalCommission: g.totalCommission, totalAmount: g.totalAmount, txnCount: g.txnCount } };
  }

  async sumTodayByBranch(tenantId: any, branchId: any): Promise<number> {
    const today = todayIST();
    const result = await TransactionModel.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          collectionBranchId: new mongoose.Types.ObjectId(branchId),
          createdAt: { $gte: istStartOfDay(today), $lte: istEndOfDay(today) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  async getCommissionDetail(tenantId: any, filters: any = {}) {
    const { branchId, fromDate, toDate, page = 1, limit = 30 } = filters;
    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (branchId) {
      const bId = new mongoose.Types.ObjectId(branchId);
      // Mirror the earningBranchId logic from getCommissionSummary:
      // earningBranchId = commissionSplit.earningBranchId ?? collectionBranchId
      // So a branch earns when explicitly named OR when they are collection branch and no earningBranchId is set.
      query.$or = [
        { 'commissionSplit.earningBranchId': bId },
        { collectionBranchId: bId, 'commissionSplit.earningBranchId': null },
      ];
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = parseISTFilterDate(fromDate, false);
      if (toDate)   query.createdAt.$lte = parseISTFilterDate(toDate, true);
    }

    const skip = (page - 1) * limit;
    const [data, total, agg] = await Promise.all([
      TransactionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('collectionBranchId', 'name code')
        .populate('payoutBranchId', 'name code')
        .populate('commissionSplit.otherBranchId', 'name code')
        .select('tokenNumber amount commissionAmount commissionType commissionValue finalAmount createdAt approvalStatus paymentStatus collectionBranchId payoutBranchId commissionSplit')
        .lean(),
      TransactionModel.countDocuments(query),
      TransactionModel.aggregate([
        { $match: query },
        { $group: { _id: null, totalCommission: { $sum: '$commissionAmount' }, totalAmount: { $sum: '$amount' }, totalFinal: { $sum: '$finalAmount' } } },
      ]),
    ]);

    const t = agg[0] || { totalCommission: 0, totalAmount: 0, totalFinal: 0 };
    return { data, total, page, limit, totals: { totalCommission: t.totalCommission, totalAmount: t.totalAmount, totalFinal: t.totalFinal } };
  }

  async findActiveByUser(tenantId: any, userId: any, branchId: any) {
    const orClauses: any[] = [
      {
        createdBy: userId,
        paymentStatus: { $ne: PAYMENT_STATUS.COMPLETED },
        approvalStatus: { $ne: APPROVAL_STATUS.REJECTED },
      },
    ];
    if (branchId) {
      orClauses.push({
        payoutBranchId: branchId,
        approvalStatus: APPROVAL_STATUS.APPROVED,
        paymentStatus: PAYMENT_STATUS.PENDING,
      });
    }
    return TransactionModel.find({ tenantId, $or: orClauses })
      .populate('collectionBranchId', 'name code')
      .populate('payoutBranchId', 'name code')
      .select('tokenNumber amount approvalStatus paymentStatus collectionBranchId payoutBranchId createdAt')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getFlowMatrix(tenantId: any, filters: any = {}) {
    const { fromDate, toDate, approvalStatus, paymentStatus } = filters;
    const matchStage: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (approvalStatus) matchStage.approvalStatus = approvalStatus;
    if (paymentStatus) matchStage.paymentStatus = paymentStatus;
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate) matchStage.createdAt.$gte = parseISTFilterDate(fromDate, false);
      if (toDate)   matchStage.createdAt.$lte = parseISTFilterDate(toDate, true);
    }

    return TransactionModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { from: '$collectionBranchId', to: '$payoutBranchId' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$commissionAmount' },
        },
      },
      { $lookup: { from: 'branches', localField: '_id.from', foreignField: '_id', as: 'fromBranch' } },
      { $lookup: { from: 'branches', localField: '_id.to', foreignField: '_id', as: 'toBranch' } },
      { $unwind: { path: '$fromBranch', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$toBranch', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          fromBranchId: '$_id.from',
          fromBranchName: '$fromBranch.name',
          fromBranchCode: '$fromBranch.code',
          toBranchId: '$_id.to',
          toBranchName: '$toBranch.name',
          toBranchCode: '$toBranch.code',
          count: 1,
          totalAmount: 1,
          totalCommission: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
  }

  async getStaffReport(tenantId: any, filters: any = {}) {
    const { fromDate, toDate, branchId } = filters;
    const matchStage: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (branchId) matchStage.collectionBranchId = new mongoose.Types.ObjectId(branchId);
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate) matchStage.createdAt.$gte = parseISTFilterDate(fromDate, false);
      if (toDate)   matchStage.createdAt.$lte = parseISTFilterDate(toDate, true);
    }

    return TransactionModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$createdBy',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalFinalAmount: { $sum: '$finalAmount' },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'branches', localField: 'user.branchId', foreignField: '_id', as: 'branch' } },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          username: '$user.username',
          role: '$user.role',
          branchId: '$user.branchId',
          branchName: '$branch.name',
          branchCode: '$branch.code',
          count: 1,
          totalAmount: 1,
          totalCommission: 1,
          totalFinalAmount: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  }
}
