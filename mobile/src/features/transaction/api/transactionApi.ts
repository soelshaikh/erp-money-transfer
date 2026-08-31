import { apiClient } from '../../../api/client';

export const transactionApi = {
  list: (params: any) => apiClient.get('/transactions', { params }).then((r) => r.data.data),
  getOne: (id: string) => apiClient.get(`/transactions/${id}`).then((r) => r.data.data),
  getLedgerTrail: (id: string) => apiClient.get(`/transactions/${id}/ledger-trail`).then((r) => r.data.data),
  create: (body: any, idempotencyKey: string) =>
    apiClient.post('/transactions', body, { headers: { 'Idempotency-Key': idempotencyKey } }).then((r) => r.data.data),
  approve: (id: string) => apiClient.post(`/transactions/${id}/approve`).then((r) => r.data.data),
  reject: (id: string, remarks: string) => apiClient.post(`/transactions/${id}/reject`, { remarks }).then((r) => r.data.data),
  completePayment: (id: string, payoutPhotoUrl?: string | null, commissionDeducted?: boolean) =>
    apiClient.post(`/transactions/${id}/complete`, {
      ...(payoutPhotoUrl ? { payoutPhotoUrl } : {}),
      ...(commissionDeducted === true ? { commissionDeducted: true } : {}),
    }).then((r) => r.data.data),
  getCommissionSummary: (params?: any) => apiClient.get('/transactions/commission-summary', { params }).then((r) => r.data.data),
  getCommissionDetail: (params: any) => apiClient.get('/transactions/commission-detail', { params }).then((r) => r.data.data),
};
