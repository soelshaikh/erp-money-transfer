import { apiClient } from '../../../api/client';

export const tenantApi = {
  list: (params: any) => apiClient.get('/tenants', { params }).then((r) => r.data.data),
  getOne: (id: string) => apiClient.get(`/tenants/${id}`).then((r) => r.data.data),
  create: (body: any) => apiClient.post('/tenants', body).then((r) => r.data.data),
  updateStatus: (id: string, status: string) => apiClient.patch(`/tenants/${id}/status`, { status }).then((r) => r.data.data),
  createHeadOffice: (tenantId: string, body: any) => apiClient.post(`/tenants/${tenantId}/head-office`, body).then((r) => r.data.data),
  updateBranchLimit: (id: string, branchLimit: number) => apiClient.patch(`/tenants/${id}/branch-limit`, { branchLimit }).then((r) => r.data.data),
  updateCommission: (id: string, commission: { type: string; value: number }) =>
    apiClient.patch(`/tenants/${id}/commission`, { commission }).then((r) => r.data),
  resetDevData: () => apiClient.delete('/tenants/reset-dev-data').then((r) => r.data.data),
  updateStaffLimit: (id: string, staffLimit: number) => apiClient.patch(`/tenants/${id}/staff-limit`, { staffLimit }).then((r) => r.data.data),
  updateTransactionLimits: (id: string, limits: { maxAmountPerTransaction?: number; dailyLimitPerBranch?: number }) =>
    apiClient.patch(`/tenants/${id}/transaction-limits`, limits).then((r) => r.data),
  updateExportFormats: (id: string, formats: string[]) =>
    apiClient.patch(`/tenants/${id}/export-formats`, { formats }).then((r) => r.data),

  // Super admin: browse company staff and manage devices cross-tenant
  listBranches: (tenantId: string) => apiClient.get(`/tenants/${tenantId}/branches`).then((r) => r.data.data),
  listTenantUsers: (tenantId: string) => apiClient.get(`/tenants/${tenantId}/users`).then((r) => r.data.data),
  listUserDevices: (tenantId: string, userId: string) => apiClient.get(`/tenants/${tenantId}/users/${userId}/devices`).then((r) => r.data.data),
  addUserDevice: (tenantId: string, userId: string, data: any) => apiClient.post(`/tenants/${tenantId}/users/${userId}/devices`, data).then((r) => r.data.data),
  removeUserDevice: (tenantId: string, userId: string, deviceId: string) => apiClient.delete(`/tenants/${tenantId}/users/${userId}/devices/${deviceId}`).then((r) => r.data.data),
};
