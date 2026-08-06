import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function externalAccountRoutes(controller: any) {
  const router = Router();
  router.use(authenticate);

  const hoOnly = authorize(ROLES.HEAD_OFFICE);

  router.get('/',              controller.list);
  router.post('/',             hoOnly, controller.create);
  router.patch('/:id',         hoOnly, controller.update);
  router.post('/:id/entries',  controller.addEntry);   // both HO and branch can add entries
  router.get('/:id/ledger',    controller.getLedger);

  return router;
}
