import { apiClient } from '../../../api/client';

export interface HQCommissionItem {
  _id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  transactionId: string;
  tokenNumber: string;
  commissionAmount: number;
  hqSharePct: number;
  hqShareAmount: number;
  // Enterprise tenants only — how much of hqShareAmount is earmarked for the other branch
  // on the transaction vs Head Office's own cut. Paying the other branch is HO's own process.
  otherBranchId?: string | null;
  otherBranchName?: string | null;
  otherBranchCode?: string | null;
  otherBranchShareAmount?: number;
  headOfficeOwnShareAmount?: number;
  status: 'pending' | 'in_settlement' | 'settled';
  settlementId: string | null;
  createdAt: string;
}

export interface HQCommissionSettlement {
  _id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  itemIds: string[];
  itemCount: number;
  totalCommission: number;
  totalHQShare: number;
  paymentMode: string;
  status: 'pending' | 'completed';
  notes: string | null;
  initiatedBySide: 'branch' | 'head_office';
  initiatedByName: string;
  initiatedAt: string;
  completedByName: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface HQCommissionSettlementWithItems extends HQCommissionSettlement {
  items: HQCommissionItem[];
}

export interface CreateSettlementParams {
  branchId?: string;
  itemIds: string[];
  paymentMode: string;
  notes?: string;
}

export const hqCommissionApi = {
  listItems: (params?: { branchId?: string }): Promise<HQCommissionItem[]> =>
    apiClient.get('/hq-commission/items', { params }).then((r) => r.data.data),

  listSettlements: (params?: { branchId?: string; status?: string; page?: number; limit?: number }) =>
    apiClient.get('/hq-commission/settlements', { params }).then((r) => r.data),

  getSettlement: (id: string): Promise<HQCommissionSettlementWithItems> =>
    apiClient.get(`/hq-commission/settlements/${id}`).then((r) => r.data.data),

  createSettlement: (body: CreateSettlementParams): Promise<HQCommissionSettlement> =>
    apiClient.post('/hq-commission/settlements', body).then((r) => r.data.data),

  completeSettlement: (id: string): Promise<HQCommissionSettlement> =>
    apiClient.patch(`/hq-commission/settlements/${id}/complete`).then((r) => r.data.data),
};
