import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { validate } from '../validators/schemas';
import { ROLES } from '../../../config/constants';

export default function settingsRoutes(settingsController: any) {
  const router = Router();

  router.use(authenticate);

  router.get('/', settingsController.get);
  router.patch('/', authorize(ROLES.HEAD_OFFICE), validate('updateSettings'), settingsController.update);

  return router;
}
