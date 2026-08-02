import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function deviceSessionRoutes(controller: any) {
  const router = Router();
  const adminOnly = [authenticate, authorize(ROLES.HEAD_OFFICE, ROLES.SUPER_ADMIN)];

  router.get('/',              ...adminOnly, controller.list);
  router.get('/mine',          authenticate, controller.mine);
  router.get('/user/:userId',  ...adminOnly, controller.listByUser);
  router.post('/suspend-all',  ...adminOnly, controller.suspendAll);
  router.patch('/:id/approve', ...adminOnly, controller.approve);
  router.patch('/:id/reject',  ...adminOnly, controller.reject);
  router.patch('/:id/suspend', authenticate, controller.suspend);

  return router;
}
