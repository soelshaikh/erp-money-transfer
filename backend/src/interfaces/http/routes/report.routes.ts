import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function reportRoutes(reportController: any) {
  const router = Router();
  router.use(authenticate);

  // Existing routes
  router.get('/', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.getReports);
  router.get('/login-activity', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.loginReport);

  // New report routes (all before /export to avoid route shadowing)
  router.get('/daily', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.dailyReport);
  router.get('/pending-queue', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.pendingQueue);
  router.get('/outstanding', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.outstandingPayments);
  router.get('/rejected', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.rejectedTransactions);
  router.get('/branch-collection', authorize(ROLES.HEAD_OFFICE), reportController.branchCollectionReport);
  router.get('/branch-flow', authorize(ROLES.HEAD_OFFICE), reportController.branchFlowMatrix);
  router.get('/daily-tally', authorize(ROLES.HEAD_OFFICE), reportController.dailyTally);
  router.get('/all-branch-balances', authorize(ROLES.HEAD_OFFICE), reportController.allBranchBalances);
  router.get('/cash-position', authorize(ROLES.HEAD_OFFICE), reportController.cashPosition);
  router.get('/staff', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.staffReport);
  router.get('/commission-overrides', authorize(ROLES.HEAD_OFFICE), reportController.commissionOverrides);
  router.get('/period-comparison', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.periodComparison);
  router.get('/payment-methods', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.paymentMethodReport);

  // Export route last (catches /export?reportType=...)
  router.get('/export', authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH), reportController.exportReports);

  return router;
}
