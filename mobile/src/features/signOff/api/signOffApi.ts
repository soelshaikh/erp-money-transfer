import { apiClient } from '../../../api/client';

export const signOffApi = {
  // Branch staff: sign off for today (authenticated)
  signOff: async () => {
    const res = await apiClient.post('/sign-off');
    return res.data?.data;
  },

  // Public: check if a signed-off user has been re-enabled by HO
  getStatus: async (slug: string, userId: string) => {
    const res = await apiClient.get('/sign-off/status', { params: { slug, userId } });
    return res.data?.data as { signedOff: boolean; reLoginEnabled: boolean };
  },

  // HO: list today's sign-offs (optionally for a specific date)
  list: async (date?: string) => {
    const res = await apiClient.get('/sign-off', { params: date ? { date } : {} });
    return res.data?.data as any[];
  },

  // HO: enable re-login for a specific sign-off record
  enableReLogin: async (id: string) => {
    const res = await apiClient.patch(`/sign-off/${id}/enable`);
    return res.data?.data;
  },
};
