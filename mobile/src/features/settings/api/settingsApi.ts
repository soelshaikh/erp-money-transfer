import { apiClient } from '../../../api/client';

export const settingsApi = {
  get: () => apiClient.get('/settings').then((r) => r.data.data),
  update: (body: any) => apiClient.patch('/settings', body).then((r) => r.data.data),
};
