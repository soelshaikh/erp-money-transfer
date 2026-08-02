import { Router } from 'express';
import authenticate from '../middleware/authenticate';

export default function dashboardRoutes(dashboardController: any) {
  const router = Router();
  router.use(authenticate);
  router.get('/', dashboardController.get);
  return router;
}
