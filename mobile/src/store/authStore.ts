import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { queryClient } from '../api/queryClient';

interface PendingDeviceInfo {
  deviceStatus: string;
  user: any;
  tenant: any;
}

interface AuthState {
  user: any;
  tenant: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingDeviceInfo: PendingDeviceInfo | null;
  login: (userData: any, tenantData: any, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  restoreSession: (userData: any, tenantData: any) => Promise<void>;
  finishLoading: () => void;
  setPendingDevice: (deviceStatus: string, user: any, tenant: any) => void;
  clearPendingDevice: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,
  pendingDeviceInfo: null,

  login: async (userData: any, tenantData: any, accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    set({ user: userData, tenant: tenantData, isAuthenticated: true, isLoading: false, pendingDeviceInfo: null });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    queryClient.clear();
    set({ user: null, tenant: null, isAuthenticated: false, isLoading: false, pendingDeviceInfo: null });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  restoreSession: async (userData: any, tenantData: any) => {
    set({ user: userData, tenant: tenantData, isAuthenticated: true, isLoading: false });
  },

  finishLoading: () => set({ isLoading: false }),

  setPendingDevice: (deviceStatus: string, user: any, tenant: any) => {
    set({ pendingDeviceInfo: { deviceStatus, user, tenant } });
  },

  clearPendingDevice: () => set({ pendingDeviceInfo: null }),
}));
