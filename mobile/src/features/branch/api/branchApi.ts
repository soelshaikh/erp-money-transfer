import { apiClient } from '../../../api/client';

export const branchApi = {
  list: (params: any) => apiClient.get('/branches', { params }).then((r) => r.data.data),
  listActive: () => apiClient.get('/branches/active').then((r) => r.data.data),
  getOne: (id: string) => apiClient.get(`/branches/${id}`).then((r) => r.data.data),
  create: (body: any) => apiClient.post('/branches', body).then((r) => r.data.data),
  update: (id: string, body: any) => apiClient.patch(`/branches/${id}`, body).then((r) => r.data.data),
  delete: (id: string) => apiClient.delete(`/branches/${id}`).then((r: any) => r.data),
  toggleStatus: (id: string) => apiClient.patch(`/branches/${id}/status`).then((r) => r.data.data),
  getLedger: (id: string, params: any) => apiClient.get(`/branches/${id}/ledger`, { params }).then((r) => r.data.data),
  getMyLedger: (params: any) => apiClient.get('/branches/my-ledger', { params }).then((r) => r.data.data),
  getBalanceSummary: () => apiClient.get('/branches/balance-summary').then((r) => r.data.data),
  getDailyBalances: (id: string, params?: any) => apiClient.get(`/branches/${id}/daily-balances`, { params }).then((r) => r.data.data),
};
