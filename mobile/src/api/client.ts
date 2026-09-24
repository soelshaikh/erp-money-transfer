import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { storage } from '../utils/storage';
import { useAuthStore } from '../store/authStore';

const CENTRAL_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const MAX_CONSECUTIVE_NETWORK_ERRORS = 5;
let consecutiveNetworkErrors = 0;

export const apiClient = axios.create({
  // baseURL is overridden per-request in the interceptor below using the stored tenant apiUrl.
  // CENTRAL_URL is only the fallback for companies that have not yet set a dedicated backend.
  baseURL: CENTRAL_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Resolve the company-specific backend URL stored after the slug/config lookup.
  // Falls back to the central URL so existing behaviour is preserved.
  const tenantApiUrl = await storage.getItemAsync('tenant_api_url');
  if (tenantApiUrl && tenantApiUrl.startsWith('http')) config.baseURL = tenantApiUrl;

  const token = await storage.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res: AxiosResponse) => {
    consecutiveNetworkErrors = 0;
    return res;
  },
  async (error: AxiosError) => {
    const original: any = error.config;
    const status = error.response?.status;
    const errorCode = (error.response?.data as any)?.error?.code;
    const { isAuthenticated, forceLogout } = useAuthStore.getState();

    // Any server response resets the network error counter
    if (error.response) {
      consecutiveNetworkErrors = 0;
    }

    // 502/503/504 — server is down or gateway can't reach it → force logout if in an active session
    if (status === 502 || status === 503 || status === 504) {
      if (isAuthenticated) await forceLogout('server_down');
      return Promise.reject(error);
    }

    // 403 COMPANY_SUSPENDED — tenant disabled by super admin → instant logout
    if (status === 403 && errorCode === 'COMPANY_SUSPENDED') {
      if (isAuthenticated) await forceLogout('company_suspended');
      return Promise.reject(error);
    }

    // No response at all — network unreachable
    if (!error.response) {
      if (isAuthenticated) {
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
          consecutiveNetworkErrors = 0;
          await forceLogout('network_unreachable');
        }
      }
      return Promise.reject(error);
    }

    // 401 — attempt a single token refresh, then retry the original request
    if (status === 401 && !original._retry) {
      if (errorCode === 'ACCOUNT_DISABLED' || errorCode === 'DEVICE_NOT_AUTHORIZED') {
        await forceLogout('account_disabled');
        return Promise.reject(error);
      }

      original._retry = true;
      try {
        const refreshToken = await storage.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('no refresh token');
        // Use the stored tenant apiUrl for the refresh call too
        const tenantApiUrl = await storage.getItemAsync('tenant_api_url');
        const resolvedUrl = (tenantApiUrl && tenantApiUrl.startsWith('http')) ? tenantApiUrl : CENTRAL_URL;
        const { data } = await axios.post(`${resolvedUrl}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;
        await storage.setItemAsync('accessToken', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        await forceLogout('session_expired');
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
