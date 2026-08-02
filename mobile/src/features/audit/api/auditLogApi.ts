import { apiClient } from '../../../api/client';

export const auditLogApi = {
  getAuditLogs: (params: {
    module?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/audit-logs', { params }).then((r) => r.data.data),
};
