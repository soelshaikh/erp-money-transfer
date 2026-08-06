import { apiClient } from '../../../api/client';

export const appAccessApi = {
  list: (status?: string) =>
    apiClient.get('/app-install', { params: status ? { status } : {} }).then((r) => r.data.data),
  approve: (deviceId: string) =>
    apiClient.patch(`/app-install/${deviceId}/approve`).then((r) => r.data.data),
  reject: (deviceId: string) =>
    apiClient.patch(`/app-install/${deviceId}/reject`).then((r) => r.data.data),
};
