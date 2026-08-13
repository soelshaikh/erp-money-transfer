import { apiClient } from '../../../api/client';

export const userApi = {
  list: (params: any) => apiClient.get('/users', { params }).then((r) => r.data.data),
  getOne: (id: string) => apiClient.get(`/users/${id}`).then((r) => r.data.data),
  create: (body: any) => apiClient.post('/users', body).then((r) => r.data.data),
  update: (id: string, body: any) => apiClient.patch(`/users/${id}`, body).then((r) => r.data.data),
  resetPassword: (id: string, newPassword: string) => apiClient.post(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data.data),
  toggleStatus: (id: string) => apiClient.patch(`/users/${id}/status`).then((r) => r.data.data),
  suspend: (id: string) => apiClient.patch(`/users/${id}/suspend`).then((r) => r.data.data),
  unsuspend: (id: string) => apiClient.patch(`/users/${id}/unsuspend`).then((r) => r.data.data),
  getActiveTransactions: (id: string) => apiClient.get(`/users/${id}/active-transactions`).then((r) => r.data.data),
  listDevices: (id: string) => apiClient.get(`/users/${id}/devices`).then((r) => r.data.data),
  addDevice: (id: string, body: { deviceId: string; deviceName?: string }) => apiClient.post(`/users/${id}/devices`, body).then((r) => r.data.data),
  removeDevice: (id: string, deviceId: string) => apiClient.delete(`/users/${id}/devices/${encodeURIComponent(deviceId)}`).then((r) => r.data.data),
};
