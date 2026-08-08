'use strict';

/**
 * One-time migration — renames CommissionPayable status 'pending' → 'pending_settlement'.
 *
 * Background: the status enum was expanded from ['pending','settled'] to a 7-value
 * lifecycle enum. Existing documents written before this change use 'pending', which
 * is no longer in the enum and is invisible to findPending / getPendingSummary
 * (both query for 'pending_settlement'). Without this migration those records are
 * orphaned from the settlement workflow.
 *
 * Run: node scripts/migrate-commission-payable-status.js
 * Safe to run multiple times — only touches documents with status === 'pending'.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await mongoose.connection.collection('commission_payables').updateMany(
    { status: 'pending' },
    { $set: { status: 'pending_settlement' } },
  );

  console.log(`Migration complete. Matched: ${result.matchedCount}, Updated: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
