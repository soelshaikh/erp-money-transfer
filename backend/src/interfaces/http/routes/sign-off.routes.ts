import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { ROLES } from '../../../config/constants';

export default function signOffRoutes(ctrl: any) {
  const r = Router();

  // Public — no auth required (checked by mobile to see if re-login is enabled)
  r.get('/status', ctrl.getStatus);

  // Branch staff: sign off for today
  r.post('/', authenticate, authorize(ROLES.BRANCH), ctrl.signOff);

  // HO: list today's sign-offs
  r.get('/', authenticate, authorize(ROLES.HEAD_OFFICE), ctrl.list);

  // HO: enable re-login for a specific user
  r.patch('/:id/enable', authenticate, authorize(ROLES.HEAD_OFFICE), ctrl.enable);

  return r;
}
