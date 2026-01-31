import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEYS = {
  THEME: 'omniswap_theme',
  AUTO_LOCK: 'omniswap_auto_lock',
  HIDDEN_CHAINS: 'omniswap_hidden_chains',
  LANGUAGE: 'omniswap_language',
};

interface SettingsState {
  theme: 'dark' | 'light';
  autoLockMinutes: number;
  hiddenChainIds: string[];
  language: string;
  isLoaded: boolean;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => Promise<void>;
  setAutoLock: (minutes: number) => Promise<void>;
  setHiddenChains: (chainIds: string[]) => Promise<void>;
  toggleChain: (chainId: string) => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
  isChainVisible: (chainId: string | number) => boolean;
  getVisibleChains: <T extends { id: string | number }>(chains: T[]) => T[];
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  theme: 'dark',
  autoLockMinutes: 5,
  hiddenChainIds: [],
  language: 'en',
  isLoaded: false,

  loadSettings: async () => {
    try {
      const [theme, autoLock, hiddenChains, language] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.THEME),
        AsyncStorage.getItem(SETTINGS_KEYS.AUTO_LOCK),
        AsyncStorage.getItem(SETTINGS_KEYS.HIDDEN_CHAINS),
        AsyncStorage.getItem(SETTINGS_KEYS.LANGUAGE),
      ]);

      set({
        theme: (theme as 'dark' | 'light') || 'dark',
        autoLockMinutes: autoLock ? parseInt(autoLock) : 5,
        hiddenChainIds: hiddenChains ? JSON.parse(hiddenChains) : [],
        language: language || 'en',
        isLoaded: true,
      });
    } catch (error) {
      console.error('[Settings] Load error:', error);
      set({ isLoaded: true });
    }
  },

  setTheme: async (theme) => {
    set({ theme });
    await AsyncStorage.setItem(SETTINGS_KEYS.THEME, theme);
  },

  setAutoLock: async (minutes) => {
    set({ autoLockMinutes: minutes });
    await AsyncStorage.setItem(SETTINGS_KEYS.AUTO_LOCK, minutes.toString());
  },

  setHiddenChains: async (chainIds) => {
    set({ hiddenChainIds: chainIds });
    await AsyncStorage.setItem(SETTINGS_KEYS.HIDDEN_CHAINS, JSON.stringify(chainIds));
  },

  toggleChain: async (chainId) => {
    const { hiddenChainIds } = get();
    const newHidden = hiddenChainIds.includes(chainId)
      ? hiddenChainIds.filter(id => id !== chainId)
      : [...hiddenChainIds, chainId];
    
    set({ hiddenChainIds: newHidden });
    await AsyncStorage.setItem(SETTINGS_KEYS.HIDDEN_CHAINS, JSON.stringify(newHidden));
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    await AsyncStorage.setItem(SETTINGS_KEYS.LANGUAGE, lang);
  },

  isChainVisible: (chainId) => {
    const { hiddenChainIds } = get();
    return !hiddenChainIds.includes(String(chainId));
  },

  getVisibleChains: (chains) => {
    const { hiddenChainIds } = get();
    return chains.filter(c => !hiddenChainIds.includes(String(c.id)));
  },
}));
