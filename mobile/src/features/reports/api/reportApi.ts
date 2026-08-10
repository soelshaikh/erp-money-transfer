import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient } from '../../../api/client';

export const reportApi = {
  getReports: (params: any) =>
    apiClient.get('/reports', { params }).then((r: any) => r.data.data),

  getLoginActivity: (params?: { startDate?: string; endDate?: string; userId?: string; branchId?: string }) =>
    apiClient.get('/reports/login-activity', { params }).then((r: any) => r.data.data.logs || []),

  getDeviceSessions: (params?: { status?: string; userId?: string }) =>
    apiClient.get('/device-sessions', { params }).then((r: any) => r.data.data || []),

  getMyDeviceSessions: () =>
    apiClient.get('/device-sessions/mine').then((r: any) => r.data.data || []),

  suspendAllSessions: () =>
    apiClient.post('/device-sessions/suspend-all').then((r: any) => r.data.data),

  suspendSession: (id: string) =>
    apiClient.patch(`/device-sessions/${id}/suspend`).then((r: any) => r.data.data),

  // ── New report endpoints ───────────────────────────────────────────────────

  getDailyReport: (params?: any) =>
    apiClient.get('/reports/daily', { params }).then((r: any) => r.data.data),

  getPendingQueue: (params?: any) =>
    apiClient.get('/reports/pending-queue', { params }).then((r: any) => r.data.data),

  getOutstandingPayments: (params?: any) =>
    apiClient.get('/reports/outstanding', { params }).then((r: any) => r.data.data),

  getRejectedTransactions: (params?: any) =>
    apiClient.get('/reports/rejected', { params }).then((r: any) => r.data.data),

  getBranchCollectionReport: (params?: any) =>
    apiClient.get('/reports/branch-collection', { params }).then((r: any) => r.data.data),

  getBranchFlowMatrix: (params?: any) =>
    apiClient.get('/reports/branch-flow', { params }).then((r: any) => r.data.data),

  getDailyTally: (params?: any) =>
    apiClient.get('/reports/daily-tally', { params }).then((r: any) => r.data.data),

  getAllBranchBalances: (params?: any) =>
    apiClient.get('/reports/all-branch-balances', { params }).then((r: any) => r.data.data),

  getCashPosition: () =>
    apiClient.get('/reports/cash-position').then((r: any) => r.data.data),

  getStaffReport: (params?: any) =>
    apiClient.get('/reports/staff', { params }).then((r: any) => r.data.data),

  getCommissionOverrides: (params?: any) =>
    apiClient.get('/reports/commission-overrides', { params }).then((r: any) => r.data.data),

  getPeriodComparison: (params?: any) =>
    apiClient.get('/reports/period-comparison', { params }).then((r: any) => r.data.data),

  getPaymentMethods: (params?: any) =>
    apiClient.get('/reports/payment-methods', { params }).then((r: any) => r.data.data),
};

export async function downloadReport(params: {
  format: 'excel' | 'pdf' | 'csv';
  reportType?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  period?: string;
  branchId?: string;
}): Promise<void> {
  const queryParams: Record<string, string> = { format: params.format };
  if (params.reportType) queryParams.reportType = params.reportType;
  if (params.startDate) queryParams.startDate = params.startDate;
  if (params.endDate) queryParams.endDate = params.endDate;
  if (params.date) queryParams.date = params.date;
  if (params.period) queryParams.period = params.period;
  if (params.branchId) queryParams.branchId = params.branchId;

  // Backend returns { base64, contentType, filename } — no arraybuffer needed
  const response = await apiClient.get('/reports/export', { params: queryParams });
  const { base64, filename } = response.data.data as { base64: string; contentType: string; filename: string };

  if (!base64) throw new Error('Export failed: no data received from server');

  const localUri = `${FileSystem.cacheDirectory}${filename}`;

  // Write base64 string directly — no btoa/Uint8Array conversion needed
  await FileSystem.writeAsStringAsync(localUri, base64, { encoding: 'base64' as any });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error('Sharing is not available on this device');

  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    csv: 'text/csv',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  await Sharing.shareAsync(localUri, {
    mimeType: mimeMap[params.format],
    dialogTitle: 'Export Report',
  });
}
