import { apiClient } from '../../../api/client';

export const authApi = {
  login: (body: any) => apiClient.post('/auth/login', body).then((r) => r.data.data),
  refresh: (refreshToken: string) => apiClient.post('/auth/refresh', { refreshToken }).then((r) => r.data.data),
  getMe: () => apiClient.get('/auth/me').then((r) => r.data.data),
};
