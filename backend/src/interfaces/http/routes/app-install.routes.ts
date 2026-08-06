import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function appInstallRoutes(controller: any) {
  const router = Router();
  const superAdminOnly = [authenticate, authorize(ROLES.SUPER_ADMIN)];

  // Existing — fire-and-forget install tracking (kept for backwards compat)
  router.post('/', controller.register);

  // New — device access gate
  router.post('/request-access', controller.requestAccess);
  router.get('/', ...superAdminOnly, controller.list);
  router.patch('/:deviceId/approve', ...superAdminOnly, controller.approve);
  router.patch('/:deviceId/reject',  ...superAdminOnly, controller.reject);

  return router;
}
