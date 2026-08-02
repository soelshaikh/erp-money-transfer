import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'branch_code';

interface ConfigState {
  branchCode: string | null;
  isConfigured: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  save: (code: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  branchCode: null,     // tenant slug — null means not configured yet
  isConfigured: false,
  isLoading: true,

  load: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      set({ branchCode: saved || null, isConfigured: !!saved, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  save: async (code: string) => {
    const trimmed = code.trim().toLowerCase();
    await AsyncStorage.setItem(STORAGE_KEY, trimmed);
    set({ branchCode: trimmed, isConfigured: true });
  },

  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ branchCode: null, isConfigured: false });
  },
}));
