import { apiClient } from '../../../api/client';

export const externalAccountApi = {
  list: (status?: string, branchId?: string) =>
    apiClient.get('/external-accounts', { params: { ...(status ? { status } : {}), ...(branchId ? { branchId } : {}) } }).then((r) => r.data.data),

  create: (body: { name: string; code: string; contactPerson?: string; phone?: string; address?: string; notes?: string }) =>
    apiClient.post('/external-accounts', body).then((r) => r.data.data),

  update: (id: string, body: any) =>
    apiClient.patch(`/external-accounts/${id}`, body).then((r) => r.data.data),

  addEntry: (id: string, body: { type: string; direction: string; amount: number; description?: string; entryDate?: string; branchId?: string }) =>
    apiClient.post(`/external-accounts/${id}/entries`, body).then((r) => r.data.data),

  getLedger: (id: string, params?: { fromDate?: string; toDate?: string }) =>
    apiClient.get(`/external-accounts/${id}/ledger`, { params }).then((r) => r.data.data),
};

export const partnerTransferApi = {
  list: (params?: { externalAccountId?: string; status?: string; fromBranchId?: string; toBranchId?: string; page?: number; limit?: number }) =>
    apiClient.get('/partner-transfers', { params }).then((r) => r.data.data),

  getOne: (id: string) =>
    apiClient.get(`/partner-transfers/${id}`).then((r) => r.data.data),

  create: (body: {
    externalAccountId: string; fromBranchId: string; toBranchId: string; amount: number;
    remarks?: string;
    senderName?: string; senderMobile?: string;
    receiverName?: string; receiverMobile?: string;
    customerTokenNo?: string;
    commissionSide?: string; commissionType?: string; commissionValue?: number;
    paymentMethod?: string;
  }) =>
    apiClient.post('/partner-transfers', body).then((r) => r.data.data),

  approve: (id: string) =>
    apiClient.post(`/partner-transfers/${id}/approve`).then((r) => r.data.data),

  complete: (id: string) =>
    apiClient.post(`/partner-transfers/${id}/complete`).then((r) => r.data.data),

  cancel: (id: string, reason?: string) =>
    apiClient.post(`/partner-transfers/${id}/cancel`, { reason }).then((r) => r.data.data),

  reject: (id: string, reason: string) =>
    apiClient.post(`/partner-transfers/${id}/reject`, { reason }).then((r) => r.data.data),
};
