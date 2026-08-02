import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function auditLogRoutes(auditLogController: any) {
  const router = Router();

  router.use(authenticate);
  router.use(authorize(ROLES.HEAD_OFFICE));

  router.get('/', auditLogController.list);

  return router;
}
