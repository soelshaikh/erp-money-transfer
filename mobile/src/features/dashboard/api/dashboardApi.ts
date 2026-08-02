import { apiClient } from '../../../api/client';

export const dashboardApi = {
  get: (params?: { fromDate?: string; toDate?: string }) => {
    const query = params
      ? `?fromDate=${params.fromDate || ''}&toDate=${params.toDate || ''}`
      : '';
    return apiClient.get(`/dashboard${query}`).then((r: any) => r.data.data);
  },
};
