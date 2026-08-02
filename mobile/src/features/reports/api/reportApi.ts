import * as FileSystem from 'expo-file-system';
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
  const extensionMap: Record<string, string> = { excel: 'xlsx', pdf: 'pdf', csv: 'csv' };
  const ext = extensionMap[params.format];
  const typeSlug = params.reportType || 'transactions';
  const localUri = `${FileSystem.cacheDirectory}report_${typeSlug}_${params.format}.${ext}`;

  const queryParams: Record<string, string> = { format: params.format };
  if (params.reportType) queryParams.reportType = params.reportType;
  if (params.startDate) queryParams.startDate = params.startDate;
  if (params.endDate) queryParams.endDate = params.endDate;
  if (params.date) queryParams.date = params.date;
  if (params.period) queryParams.period = params.period;
  if (params.branchId) queryParams.branchId = params.branchId;

  // apiClient interceptor handles token refresh automatically
  const response = await apiClient.get('/reports/export', {
    params: queryParams,
    responseType: 'arraybuffer',
  });

  // Convert ArrayBuffer → base64 in 1 KB chunks to avoid call-stack overflow
  const uint8 = new Uint8Array(response.data as ArrayBuffer);
  const CHUNK = 1024;
  const parts: string[] = [];
  for (let i = 0; i < uint8.length; i += CHUNK) {
    parts.push(String.fromCharCode(...Array.from(uint8.subarray(i, i + CHUNK))));
  }
  const base64 = btoa(parts.join(''));

  await FileSystem.writeAsStringAsync(localUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }

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
