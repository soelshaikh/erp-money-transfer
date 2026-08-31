import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { validate } from '../validators/schemas';
import idempotency from '../middleware/idempotency';
import { ROLES } from '../../../config/constants';

export default function transactionRoutes(txController: any) {
  const router = Router();

  router.use(authenticate);

  router.get('/commission-summary', txController.commissionSummary);
  router.get('/commission-detail', txController.commissionDetail);
  router.get('/', txController.list);
  router.get('/:id', txController.getOne);
  router.get('/:id/ledger-trail', txController.ledgerTrail);

  router.post(
    '/',
    authorize(ROLES.BRANCH),
    idempotency,
    validate('createTransaction'),
    txController.create
  );

  router.post(
    '/:id/approve',
    authorize(ROLES.HEAD_OFFICE),
    txController.approve
  );

  router.post(
    '/:id/reject',
    authorize(ROLES.HEAD_OFFICE),
    validate('rejectTransaction'),
    txController.reject
  );

  router.post(
    '/:id/complete',
    authorize(ROLES.BRANCH),
    validate('completePayment'),
    txController.complete
  );

  return router;
}
