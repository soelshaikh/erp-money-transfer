import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function commissionSettlementRoutes(controller: any) {
  const router = Router();

  router.use(authenticate);
  // Both head_office and branch can access — branch sees only their own branch data (enforced by controller via tenantId)
  router.use(authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH));

  // Commission payables (individual transaction-level debts)
  router.get('/payables', controller.listPayables);

  // Commission settlements (bulk settlement records)
  router.get('/', controller.listSettlements);
  router.get('/:id', controller.getSettlement);
  router.post('/', controller.create);
  router.patch('/:id/complete', controller.complete);

  return router;
}
