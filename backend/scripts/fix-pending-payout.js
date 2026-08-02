'use strict';

/**
 * One-time fix — backfills pendingPayout on branches AND creates missing
 * pending_payout ledger entries for all PENDING transactions that existed
 * before the pendingPayout feature was added.
 *
 * Run: node scripts/fix-pending-payout.js
 * Safe to run multiple times — skips entries that already exist.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI must be set in backend/.env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const Transaction = mongoose.connection.db.collection('transactions');
  const Branch = mongoose.connection.db.collection('branches');
  const BranchLedger = mongoose.connection.db.collection('branch_ledger');

  // ── Step 1: Reset pendingPayout on ALL branches ────────────────────────────
  await Branch.updateMany({}, { $set: { pendingPayout: 0 } });
  console.log('Reset pendingPayout to 0 on all branches');

  // ── Step 2: Get all PENDING transactions sorted oldest first ───────────────
  const pending = await Transaction.find({ approvalStatus: 'pending' })
    .sort({ createdAt: 1 })
    .toArray();
  console.log(`Found ${pending.length} pending transaction(s)`);

  if (pending.length === 0) {
    console.log('Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  // ── Step 3: Delete any existing pending_payout ledger entries for these txns
  //    (so we don't duplicate if this script is re-run)
  const txnIds = pending.map((t) => t._id);
  const deleted = await BranchLedger.deleteMany({
    transactionId: { $in: txnIds },
    event: 'pending_payout',
  });
  if (deleted.deletedCount > 0) {
    console.log(`Removed ${deleted.deletedCount} stale pending_payout ledger entries`);
  }

  // ── Step 4: Build ledger entries, tracking running balance per payout branch
  const runningBalance = {}; // branchId → { balance, committedPayout, pendingPayout }

  // Pre-load current branch states (after reset, all pendingPayout = 0)
  const allBranchIds = [...new Set(pending.map((t) => t.payoutBranchId.toString()))];
  for (const id of allBranchIds) {
    const b = await Branch.findOne({ _id: new mongoose.Types.ObjectId(id) });
    runningBalance[id] = {
      balance: b?.balance ?? 0,
      committedPayout: b?.committedPayout ?? 0,
      pendingPayout: 0, // we just reset this
    };
  }

  const ledgerEntries = [];

  for (const txn of pending) {
    const branchId = txn.payoutBranchId.toString();
    const finalAmount = txn.finalAmount ?? txn.amount;
    const state = runningBalance[branchId];

    const effectiveBefore = state.balance - state.committedPayout - state.pendingPayout;
    state.pendingPayout += finalAmount;
    const effectiveAfter = state.balance - state.committedPayout - state.pendingPayout;

    ledgerEntries.push({
      tenantId: txn.tenantId,
      branchId: txn.payoutBranchId,
      transactionId: txn._id,
      type: 'pending_debit',
      amount: finalAmount,
      actualBalanceBefore: state.balance,
      actualBalanceAfter: state.balance,
      effectiveBalanceBefore: effectiveBefore,
      effectiveBalanceAfter: effectiveAfter,
      description: `Pending payout ₹${finalAmount} (Token ${txn.tokenNumber})`,
      event: 'pending_payout',
      tokenNumber: txn.tokenNumber,
      createdAt: txn.createdAt,
      updatedAt: txn.createdAt,
    });
  }

  if (ledgerEntries.length > 0) {
    await BranchLedger.insertMany(ledgerEntries);
    console.log(`Created ${ledgerEntries.length} pending_payout ledger entry/entries`);
  }

  // ── Step 5: Set final pendingPayout on each payout branch ─────────────────
  for (const [branchId, state] of Object.entries(runningBalance)) {
    await Branch.updateOne(
      { _id: new mongoose.Types.ObjectId(branchId) },
      { $set: { pendingPayout: state.pendingPayout } }
    );
    console.log(`  Branch ${branchId} → pendingPayout = ₹${state.pendingPayout}`);
  }

  console.log('Done.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
