import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SLUG_KEY   = 'branch_code';
const DEVICE_KEY = 'device_approval_status';

type DeviceApprovalStatus = 'none' | 'pending' | 'approved';

interface ConfigState {
  branchCode: string | null;
  isConfigured: boolean;
  deviceApprovalStatus: DeviceApprovalStatus;
  isDeviceApproved: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  save: (code: string) => Promise<void>;
  clear: () => Promise<void>;
  setDeviceStatus: (status: DeviceApprovalStatus) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  branchCode: null,
  isConfigured: false,
  deviceApprovalStatus: 'none',
  isDeviceApproved: false,
  isLoading: true,

  load: async () => {
    try {
      const [slug, deviceStatus] = await AsyncStorage.multiGet([SLUG_KEY, DEVICE_KEY]);
      const savedSlug   = slug[1] || null;
      const savedDevice = (deviceStatus[1] as DeviceApprovalStatus) || 'none';
      set({
        branchCode: savedSlug,
        isConfigured: !!savedSlug,
        deviceApprovalStatus: savedDevice,
        isDeviceApproved: savedDevice === 'approved',
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  save: async (code: string) => {
    const trimmed = code.trim().toLowerCase();
    await AsyncStorage.setItem(SLUG_KEY, trimmed);
    set({ branchCode: trimmed, isConfigured: true });
  },

  clear: async () => {
    await AsyncStorage.multiRemove([SLUG_KEY, DEVICE_KEY]);
    set({ branchCode: null, isConfigured: false, deviceApprovalStatus: 'none', isDeviceApproved: false });
  },

  setDeviceStatus: async (status: DeviceApprovalStatus) => {
    await AsyncStorage.setItem(DEVICE_KEY, status);
    set({ deviceApprovalStatus: status, isDeviceApproved: status === 'approved' });
  },
}));
