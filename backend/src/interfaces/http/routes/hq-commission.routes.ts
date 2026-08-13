import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { validate } from '../validators/schemas';
import { ROLES } from '../../../config/constants';

export default function hqCommissionRoutes(hqCommissionController: any) {
  const router = Router();

  router.use(authenticate);
  router.use(authorize(ROLES.HEAD_OFFICE, ROLES.BRANCH));

  // Both branch and HO can view pending items and settlements
  router.get('/items', hqCommissionController.listItems);
  router.get('/settlements', hqCommissionController.listSettlements);
  router.get('/settlements/:id', hqCommissionController.getSettlement);

  // Both sides can create a settlement
  router.post('/settlements', validate('createHQSettlement'), hqCommissionController.createSettlement);

  // Both sides can mark complete (HO marks received, branch confirms if HO initiated)
  router.patch('/settlements/:id/complete', hqCommissionController.completeSettlement);

  return router;
}
