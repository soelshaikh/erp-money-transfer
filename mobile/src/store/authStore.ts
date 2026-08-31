import { create } from 'zustand';
import { storage } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '../api/queryClient';

const SIGN_OFF_KEY = 'sign_off_state'; // JSON: { date, userId }

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
  pendingLoginParams: any | null;
  // Sign-off state
  isSignedOff: boolean;
  signedOffDate: string | null;   // YYYY-MM-DD IST
  signedOffUserId: string | null;
  // Actions
  login: (userData: any, tenantData: any, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  restoreSession: (userData: any, tenantData: any) => Promise<void>;
  finishLoading: () => void;
  setPendingDevice: (deviceStatus: string, user: any, tenant: any) => void;
  setPendingLoginParams: (params: any) => void;
  clearPendingDevice: () => void;
  signOff: (userId: string) => Promise<void>;
  clearSignOff: () => Promise<void>;
  loadSignOffState: () => Promise<void>;
}

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,
  pendingDeviceInfo: null,
  pendingLoginParams: null,
  isSignedOff: false,
  signedOffDate: null,
  signedOffUserId: null,

  login: async (userData: any, tenantData: any, accessToken: string, refreshToken: string) => {
    await storage.setItemAsync('accessToken', accessToken);
    await storage.setItemAsync('refreshToken', refreshToken);
    // Clear any lingering sign-off state on successful login
    await AsyncStorage.removeItem(SIGN_OFF_KEY);
    set({ user: userData, tenant: tenantData, isAuthenticated: true, isLoading: false, pendingDeviceInfo: null, pendingLoginParams: null, isSignedOff: false, signedOffDate: null, signedOffUserId: null });
  },

  logout: async () => {
    await storage.deleteItemAsync('accessToken');
    await storage.deleteItemAsync('refreshToken');
    await AsyncStorage.removeItem(SIGN_OFF_KEY);
    queryClient.clear();
    set({ user: null, tenant: null, isAuthenticated: false, isLoading: false, pendingDeviceInfo: null, pendingLoginParams: null, isSignedOff: false, signedOffDate: null, signedOffUserId: null });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  restoreSession: async (userData: any, tenantData: any) => {
    set({ user: userData, tenant: tenantData, isAuthenticated: true, isLoading: false });
  },

  finishLoading: () => set({ isLoading: false }),

  setPendingDevice: (deviceStatus: string, user: any, tenant: any) => {
    set({ pendingDeviceInfo: { deviceStatus, user, tenant } });
  },

  setPendingLoginParams: (params: any) => set({ pendingLoginParams: params }),

  clearPendingDevice: () => set({ pendingDeviceInfo: null, pendingLoginParams: null }),

  signOff: async (userId: string) => {
    const date = todayIST();
    await storage.deleteItemAsync('accessToken');
    await storage.deleteItemAsync('refreshToken');
    queryClient.clear();
    await AsyncStorage.setItem(SIGN_OFF_KEY, JSON.stringify({ date, userId }));
    set({
      user: null, tenant: null, isAuthenticated: false, isLoading: false,
      pendingDeviceInfo: null, pendingLoginParams: null,
      isSignedOff: true, signedOffDate: date, signedOffUserId: userId,
    });
  },

  clearSignOff: async () => {
    await AsyncStorage.removeItem(SIGN_OFF_KEY);
    set({ isSignedOff: false, signedOffDate: null, signedOffUserId: null });
  },

  loadSignOffState: async () => {
    try {
      const raw = await AsyncStorage.getItem(SIGN_OFF_KEY);
      if (!raw) return;
      const { date, userId } = JSON.parse(raw);
      const today = todayIST();
      if (date !== today) {
        // Sign-off expired — new day
        await AsyncStorage.removeItem(SIGN_OFF_KEY);
        return;
      }
      set({ isSignedOff: true, signedOffDate: date, signedOffUserId: userId });
    } catch { /* ignore */ }
  },
}));
