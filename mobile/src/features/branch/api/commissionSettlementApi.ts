import { apiClient } from '../../../api/client';

export const commissionSettlementApi = {
  // Individual commission payables (per transaction debts)
  listPayables: (params?: {
    fromBranchId?: string;
    toBranchId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
    summaryOnly?: boolean;
  }) => apiClient.get('/commission-settlements/payables', { params }).then((r: any) => r.data.data),

  // Bulk settlement records
  listSettlements: (params?: {
    fromBranchId?: string;
    toBranchId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/commission-settlements', { params }).then((r: any) => r.data.data),

  getSettlement: (id: string) =>
    apiClient.get(`/commission-settlements/${id}`).then((r: any) => r.data.data),

  createSettlement: (body: { fromBranchId: string; toBranchId: string; notes?: string }) =>
    apiClient.post('/commission-settlements', body).then((r: any) => r.data.data),

  completeSettlement: (id: string) =>
    apiClient.patch(`/commission-settlements/${id}/complete`).then((r: any) => r.data.data),
};
