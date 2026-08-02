import { apiClient } from '../../../api/client';

export const deviceSessionApi = {
  list: (params?: { status?: string }) =>
    apiClient.get('/device-sessions', { params }).then((r: any) => r.data.data || []),
  approve: (id: string) =>
    apiClient.patch(`/device-sessions/${id}/approve`).then((r: any) => r.data.data),
  reject: (id: string) =>
    apiClient.patch(`/device-sessions/${id}/reject`).then((r: any) => r.data.data),
  suspend: (id: string) =>
    apiClient.patch(`/device-sessions/${id}/suspend`).then((r: any) => r.data.data),
};
