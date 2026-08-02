import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import NotificationModel from '../../../infrastructure/db/models/Notification.model';

export default function notificationRoutes() {
  const router = Router();
  router.use(authenticate);

  // GET /notifications — list for current user
  router.get('/', async (req: any, res: any) => {
    const { tenantId, id: userId } = req.user;
    const notifications = await NotificationModel.find({ tenantId, userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: notifications });
  });

  // PATCH /notifications/:id/read — mark one as read
  router.patch('/:id/read', async (req: any, res: any) => {
    const { tenantId, id: userId } = req.user;
    await NotificationModel.findOneAndUpdate(
      { _id: req.params.id, tenantId, userId },
      { isRead: true }
    );
    res.json({ success: true });
  });

  // PATCH /notifications/read-all — mark all as read
  router.patch('/read-all', async (req: any, res: any) => {
    const { tenantId, id: userId } = req.user;
    await NotificationModel.updateMany({ tenantId, userId, isRead: false }, { isRead: true });
    res.json({ success: true });
  });

  return router;
}
