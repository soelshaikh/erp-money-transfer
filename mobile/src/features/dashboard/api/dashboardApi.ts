import { apiClient } from '../../../api/client';

export const dashboardApi = {
  get: (params?: { fromDate?: string; toDate?: string }) => {
    const query = params
      ? `?fromDate=${params.fromDate || ''}&toDate=${params.toDate || ''}`
      : '';
    return apiClient.get(`/dashboard${query}`).then((r: any) => {
      const d = r.data.data;
      if (d?.balance !== undefined) console.log('[Dashboard] balance from server:', d.balance, '| partners:', JSON.stringify(d.partners?.map((p: any) => ({ name: p.name, balance: p.balance }))));
      return d;
    });
  },
};
