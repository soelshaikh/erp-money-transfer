import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';

// In production set EXPO_PUBLIC_API_URL in your .env
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

console.log('[API] BASE_URL =', BASE_URL);

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  console.log('[API] -->', config.method?.toUpperCase(), config.baseURL + config.url);
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — try token refresh, then retry once
apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: AxiosError) => {
    console.log('[API] ERROR', error.code, error.message, 'url:', error.config?.url);
    const original: any = error.config;
    if (error.response?.status === 401 && !original._retry) {
      const errorCode = (error.response?.data as any)?.error?.code;

      // Account disabled — logout immediately, no retry
      if (errorCode === 'ACCOUNT_DISABLED') {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;
        await SecureStore.setItemAsync('accessToken', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        // Refresh failed — clear tokens and reset auth state so AppNavigator redirects to login
        await useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);
