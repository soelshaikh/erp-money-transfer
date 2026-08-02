import { Router } from 'express';

export default function appInstallRoutes(controller: any) {
  const router = Router();
  router.post('/', controller.register);
  return router;
}
