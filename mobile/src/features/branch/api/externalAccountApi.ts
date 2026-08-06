import { apiClient } from '../../../api/client';

export const externalAccountApi = {
  list: (status?: string) =>
    apiClient.get('/external-accounts', { params: status ? { status } : {} }).then((r) => r.data.data),

  create: (body: { name: string; code: string; contactPerson?: string; phone?: string; address?: string; notes?: string }) =>
    apiClient.post('/external-accounts', body).then((r) => r.data.data),

  update: (id: string, body: any) =>
    apiClient.patch(`/external-accounts/${id}`, body).then((r) => r.data.data),

  addEntry: (id: string, body: { type: string; direction: string; amount: number; description?: string; entryDate?: string }) =>
    apiClient.post(`/external-accounts/${id}/entries`, body).then((r) => r.data.data),

  getLedger: (id: string, params?: { fromDate?: string; toDate?: string }) =>
    apiClient.get(`/external-accounts/${id}/ledger`, { params }).then((r) => r.data.data),
};
