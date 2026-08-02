import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { validate } from '../validators/schemas';
import { ROLES } from '../../../config/constants';

export default function branchRoutes(branchController: any) {
  const router = Router();

  router.use(authenticate);

  router.get('/active', branchController.listActive);
  router.get('/my-ledger', authorize(ROLES.BRANCH), branchController.myLedger);
  router.get('/balance-summary', authorize(ROLES.HEAD_OFFICE), branchController.balanceSummary);
  router.get('/:id/daily-balances', authorize(ROLES.HEAD_OFFICE), branchController.dailyBalances);
  router.get('/:id/ledger', authorize(ROLES.HEAD_OFFICE), branchController.ledger);
  router.get('/', branchController.list);
  router.get('/:id', branchController.getOne);
  router.post('/', authorize(ROLES.HEAD_OFFICE), validate('createBranch'), branchController.create);
  router.patch('/:id/status', authorize(ROLES.HEAD_OFFICE), branchController.toggleStatus);
  router.patch('/:id', authorize(ROLES.HEAD_OFFICE), validate('updateBranch'), branchController.update);
  router.delete('/:id', authorize(ROLES.HEAD_OFFICE), branchController.deleteBranch);

  return router;
}
