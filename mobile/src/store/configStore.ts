import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../utils/storage';

const SLUG_KEY   = 'branch_code';
const DEVICE_KEY = 'device_approval_status';
const API_URL_KEY = 'tenant_api_url';

type DeviceApprovalStatus = 'none' | 'pending' | 'approved';

interface ConfigState {
  branchCode: string | null;
  apiUrl: string | null;
  isConfigured: boolean;
  deviceApprovalStatus: DeviceApprovalStatus;
  isDeviceApproved: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  save: (code: string, apiUrl?: string) => Promise<void>;
  clear: () => Promise<void>;
  setDeviceStatus: (status: DeviceApprovalStatus) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  branchCode: null,
  apiUrl: null,
  isConfigured: false,
  deviceApprovalStatus: 'none',
  isDeviceApproved: false,
  isLoading: true,

  load: async () => {
    try {
      // SLUG_KEY — not sensitive, AsyncStorage is fine
      // DEVICE_KEY and API_URL_KEY — security-sensitive, SecureStore
      const savedSlug   = await AsyncStorage.getItem(SLUG_KEY);
      const savedDevice = ((await storage.getItemAsync(DEVICE_KEY)) as DeviceApprovalStatus) || 'none';
      const savedApiUrl = await storage.getItemAsync(API_URL_KEY);
      set({
        branchCode: savedSlug || null,
        apiUrl: savedApiUrl || null,
        isConfigured: !!savedSlug,
        deviceApprovalStatus: savedDevice,
        isDeviceApproved: savedDevice === 'approved',
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  // Called after successful central config lookup — stores slug and optionally the resolved apiUrl.
  // apiUrl is omitted when called from LoginScreen (slug-only save); omitting it preserves the
  // previously stored URL so it is never overwritten with the literal string "undefined".
  save: async (code: string, apiUrl?: string) => {
    const trimmed = code.trim().toLowerCase();
    await AsyncStorage.setItem(SLUG_KEY, trimmed);
    if (apiUrl) await storage.setItemAsync(API_URL_KEY, apiUrl);
    set({ branchCode: trimmed, isConfigured: true, ...(apiUrl ? { apiUrl } : {}) });
  },

  clear: async () => {
    await AsyncStorage.removeItem(SLUG_KEY);
    await storage.deleteItemAsync(DEVICE_KEY);
    await storage.deleteItemAsync(API_URL_KEY);
    set({ branchCode: null, apiUrl: null, isConfigured: false, deviceApprovalStatus: 'none', isDeviceApproved: false });
  },

  setDeviceStatus: async (status: DeviceApprovalStatus) => {
    await storage.setItemAsync(DEVICE_KEY, status);
    set({ deviceApprovalStatus: status, isDeviceApproved: status === 'approved' });
  },
}));
