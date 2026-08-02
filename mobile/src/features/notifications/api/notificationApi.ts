import { apiClient } from '../../../api/client';

export const notificationApi = {
  list: (params?: any) =>
    apiClient.get('/notifications', { params }).then((r: any) => r.data.data),
  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then((r: any) => r.data),
  markAllRead: () =>
    apiClient.patch('/notifications/read-all').then((r: any) => r.data),
};
