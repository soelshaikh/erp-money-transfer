/**
 * Quick MongoDB query runner — edit the query at the bottom, then run:
 *   node backend/scripts/query.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const BRANCH_SCHEMA = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  name: String,
  code: String,
  type: String,
  balance: Number,
  committedPayout: Number,
  pendingPayout: Number,
  payoutCompleted: Number,
  commissionPayable: Number,
  commissionReceivable: Number,
}, { collection: 'branches' });

const EXTERNAL_ACC_SCHEMA = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  name: String,
  code: String,
  balance: Number,
  onHold: Number,
  status: String,
}, { collection: 'external_accounts' });

const BRANCH_LEDGER_SCHEMA = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  branchId: mongoose.Schema.Types.ObjectId,
  event: String,
  type: String,
  amount: Number,
  description: String,
  actualBalanceBefore: Number,
  actualBalanceAfter: Number,
  createdAt: Date,
}, { collection: 'branch_ledger', timestamps: true });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const Branch = mongoose.model('Branch', BRANCH_SCHEMA);
  const ExternalAccount = mongoose.model('ExternalAccount', EXTERNAL_ACC_SCHEMA);
  const BranchLedger = mongoose.model('BranchLedger', BRANCH_LEDGER_SCHEMA);

  // ── 1. All branches + balances ──────────────────────────────────────────────
  const branches = await Branch.find({}).select('name code type balance committedPayout pendingPayout').sort({ name: 1 }).lean();
  console.log('=== BRANCHES ===');
  branches.forEach(b => {
    const effective = (b.balance || 0) - (b.committedPayout || 0) - (b.pendingPayout || 0);
    console.log(`  [${b.code}] ${b.name} (${b.type})`);
    console.log(`    balance=${b.balance}  committed=${b.committedPayout}  pending=${b.pendingPayout}  effective=${effective}`);
    console.log(`    _id: ${b._id}`);
  });

  // ── 2. All partners + balances ──────────────────────────────────────────────
  const partners = await ExternalAccount.find({}).select('name code balance onHold status').lean();
  console.log('\n=== PARTNERS ===');
  partners.forEach(p => {
    console.log(`  [${p.code}] ${p.name} — balance=${p.balance} onHold=${p.onHold} status=${p.status}`);
    console.log(`    _id: ${p._id}`);
  });

  // ── 3. Last 10 BranchLedger entries (all branches) ─────────────────────────
  const ledger = await BranchLedger.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('\n=== LAST 10 BRANCH LEDGER ENTRIES ===');
  ledger.forEach(l => {
    console.log(`  [${l.event}] ${l.type} ₹${l.amount} | before=${l.actualBalanceBefore} after=${l.actualBalanceAfter}`);
    console.log(`    branch=${l.branchId} | ${l.description} | ${l.createdAt}`);
  });

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
