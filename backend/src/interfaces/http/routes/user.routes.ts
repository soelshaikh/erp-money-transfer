import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { validate } from '../validators/schemas';
import { ROLES } from '../../../config/constants';

export default function userRoutes(userController: any) {
  const router = Router();

  router.use(authenticate);
  router.use(authorize(ROLES.HEAD_OFFICE));

  router.get('/', userController.list);
  router.post('/', validate('createUser'), userController.create);
  router.post('/:id/reset-password', validate('resetPassword'), userController.resetPwd);
  router.get('/:id/devices', userController.listDevices);
  router.post('/:id/devices', validate('addDevice'), userController.addDevice);
  router.delete('/:id/devices/:deviceId', userController.removeDevice);
  router.get('/:id/active-transactions', userController.getActiveTransactions);
  router.patch('/:id/status', userController.toggleStatus);
  router.patch('/:id/suspend', userController.suspendUser);
  router.patch('/:id/unsuspend', userController.unsuspendUser);
  router.get('/:id', userController.getOne);
  router.patch('/:id', validate('updateUser'), userController.update);

  return router;
}
