import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function partnerTransferRoutes(ptController: any) {
  const router = Router();

  router.use(authenticate);

  router.get('/', ptController.list);
  router.get('/:id', ptController.getOne);

  router.post('/', ptController.create);

  router.post('/:id/approve', authorize(ROLES.HEAD_OFFICE), ptController.approve);

  router.post('/:id/complete', ptController.complete);

  router.post('/:id/cancel', ptController.cancel);

  router.post('/:id/reject', authorize(ROLES.HEAD_OFFICE), ptController.reject);

  return router;
}
