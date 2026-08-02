import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const STORAGE_KEY = 'app_lang';

type Lang = 'en' | 'gu';

interface LangState {
  lang: Lang;
  load: () => Promise<void>;
  setLang: (lang: Lang) => Promise<void>;
}

export const useLangStore = create<LangState>((set) => ({
  lang: 'en',

  load: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY) as Lang | null;
      const lang: Lang = saved === 'gu' ? 'gu' : 'en';
      await i18n.changeLanguage(lang);
      set({ lang });
    } catch {
      // keep default 'en'
    }
  },

  setLang: async (lang: Lang) => {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
    await i18n.changeLanguage(lang);
    set({ lang });
  },
}));
