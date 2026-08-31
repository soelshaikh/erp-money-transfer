import { Router } from 'express';
import { validate } from '../validators/schemas';
import { authLimiter } from '../middleware/rateLimiter';
import authenticate from '../middleware/authenticate';

export default function authRoutes(authController: any) {
  const router = Router();

  router.get('/validate-company', authLimiter, authController.validateCompany);
  router.post('/login', authLimiter, validate('login'), authController.login);
  router.post('/refresh', validate('refreshToken'), authController.refresh);
  router.get('/me', authenticate, authController.me);

  return router;
}
