import mongoose from 'mongoose';
import { BusinessRuleError } from '../../../domain/errors';

export default class ResetDevData {
  async execute(): Promise<Record<string, number>> {
    if (process.env.NODE_ENV === 'production') {
      throw new BusinessRuleError('This operation is not allowed in production');
    }

    const db = mongoose.connection.db;
    if (!db) throw new BusinessRuleError('Database not connected');

    // Identify the system tenant and super admin user before deleting anything
    const systemTenant = await db.collection('tenants').findOne({ slug: 'system' });
    const superAdminUser = await db.collection('users').findOne({ role: 'super_admin' });

    const counts: Record<string, number> = {};

    // Delete all tenants except the system tenant
    const tenantFilter = systemTenant ? { _id: { $ne: systemTenant._id } } : {};
    const tenantResult = await db.collection('tenants').deleteMany(tenantFilter);
    counts.tenants = tenantResult.deletedCount;

    // Delete all branches
    const branchResult = await db.collection('branches').deleteMany({});
    counts.branches = branchResult.deletedCount;

    // Delete all users except the super admin
    const userFilter = superAdminUser ? { _id: { $ne: superAdminUser._id } } : {};
    const userResult = await db.collection('users').deleteMany(userFilter);
    counts.users = userResult.deletedCount;

    // Delete all transactions
    const txnResult = await db.collection('transactions').deleteMany({});
    counts.transactions = txnResult.deletedCount;

    // Delete all branch ledger entries
    const ledgerResult = await db.collection('branch_ledger').deleteMany({});
    counts.branch_ledger = ledgerResult.deletedCount;

    // Delete all notifications
    const notifResult = await db.collection('notifications').deleteMany({});
    counts.notifications = notifResult.deletedCount;

    // Delete all audit logs
    const auditResult = await db.collection('audit_logs').deleteMany({});
    counts.audit_logs = auditResult.deletedCount;

    // Delete all idempotency records
    const idempotencyResult = await db.collection('idempotency').deleteMany({});
    counts.idempotency = idempotencyResult.deletedCount;

    return counts;
  }
}
