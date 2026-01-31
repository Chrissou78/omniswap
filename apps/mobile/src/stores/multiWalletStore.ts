import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'OMNISWAP_MULTI_WALLETS';
const ACTIVE_WALLET_KEY = 'OMNISWAP_ACTIVE_WALLET';

export interface WalletInfo {
  id: string;
  name: string;
  evmAddress: string;
  solanaAddress: string;
  suiAddress: string;
  tronAddress: string;
  createdAt: number;
  // Store encrypted mnemonic reference for switching
  mnemonicHash?: string;
}

interface MultiWalletState {
  wallets: WalletInfo[];
  activeWalletId: string | null;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  addWallet: (wallet: Omit<WalletInfo, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string; walletId?: string }>;
  removeWallet: (id: string) => Promise<void>;
  setActiveWallet: (id: string) => Promise<boolean>;
  getActiveWallet: () => WalletInfo | null;
  renameWallet: (id: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  isNameTaken: (name: string, excludeId?: string) => boolean;
  generateUniqueName: (baseName: string) => string;
  updateWalletAddresses: (id: string, addresses: Partial<Pick<WalletInfo, 'evmAddress' | 'solanaAddress' | 'suiAddress' | 'tronAddress'>>) => Promise<void>;
}

export const useMultiWalletStore = create<MultiWalletState>((set, get) => ({
  wallets: [],
  activeWalletId: null,
  isInitialized: false,

  initialize: async () => {
    try {
      const walletsJson = await AsyncStorage.getItem(STORAGE_KEY);
      const activeId = await AsyncStorage.getItem(ACTIVE_WALLET_KEY);
      
      const wallets = walletsJson ? JSON.parse(walletsJson) : [];
      
      set({
        wallets,
        activeWalletId: activeId || (wallets.length > 0 ? wallets[0].id : null),
        isInitialized: true,
      });
      
      console.log('[MultiWallet] Initialized with', wallets.length, 'wallets, active:', activeId);
    } catch (error) {
      console.error('[MultiWallet] Initialize error:', error);
      set({ isInitialized: true });
    }
  },

  isNameTaken: (name: string, excludeId?: string) => {
    const { wallets } = get();
    const normalizedName = name.trim().toLowerCase();
    return wallets.some(w => 
      w.name.trim().toLowerCase() === normalizedName && w.id !== excludeId
    );
  },

  generateUniqueName: (baseName: string) => {
    const { wallets } = get();
    let name = baseName.trim();
    let counter = 1;
    
    while (wallets.some(w => w.name.trim().toLowerCase() === name.toLowerCase())) {
      counter++;
      name = `${baseName.trim()} ${counter}`;
    }
    
    return name;
  },

  addWallet: async (walletData) => {
    const { wallets, isNameTaken } = get();
    
    if (isNameTaken(walletData.name)) {
      return { 
        success: false, 
        error: `Wallet name "${walletData.name}" already exists. Please choose a different name.` 
      };
    }
    
    const newWallet: WalletInfo = {
      ...walletData,
      id: `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    
    const updatedWallets = [...wallets, newWallet];
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWallets));
      
      // If first wallet or no active wallet, set as active
      const { activeWalletId } = get();
      if (wallets.length === 0 || !activeWalletId) {
        await AsyncStorage.setItem(ACTIVE_WALLET_KEY, newWallet.id);
        set({ wallets: updatedWallets, activeWalletId: newWallet.id });
      } else {
        set({ wallets: updatedWallets });
      }
      
      console.log('[MultiWallet] Added wallet:', newWallet.name, newWallet.id);
      return { success: true, walletId: newWallet.id };
    } catch (error) {
      console.error('[MultiWallet] Add wallet error:', error);
      return { success: false, error: 'Failed to save wallet' };
    }
  },

  removeWallet: async (id: string) => {
    const { wallets, activeWalletId } = get();
    const updatedWallets = wallets.filter(w => w.id !== id);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWallets));
      
      if (activeWalletId === id) {
        const newActiveId = updatedWallets.length > 0 ? updatedWallets[0].id : null;
        if (newActiveId) {
          await AsyncStorage.setItem(ACTIVE_WALLET_KEY, newActiveId);
        } else {
          await AsyncStorage.removeItem(ACTIVE_WALLET_KEY);
        }
        set({ wallets: updatedWallets, activeWalletId: newActiveId });
      } else {
        set({ wallets: updatedWallets });
      }
      
      console.log('[MultiWallet] Removed wallet:', id);
    } catch (error) {
      console.error('[MultiWallet] Remove wallet error:', error);
    }
  },

  setActiveWallet: async (id: string) => {
    const { wallets } = get();
    const wallet = wallets.find(w => w.id === id);
    
    if (!wallet) {
      console.error('[MultiWallet] Wallet not found:', id);
      return false;
    }
    
    try {
      await AsyncStorage.setItem(ACTIVE_WALLET_KEY, id);
      set({ activeWalletId: id });
      console.log('[MultiWallet] Switched to wallet:', wallet.name, id);
      return true;
    } catch (error) {
      console.error('[MultiWallet] Set active wallet error:', error);
      return false;
    }
  },

  getActiveWallet: () => {
    const { wallets, activeWalletId } = get();
    return wallets.find(w => w.id === activeWalletId) || null;
  },

  renameWallet: async (id: string, newName: string) => {
    const { wallets, isNameTaken } = get();
    
    if (isNameTaken(newName, id)) {
      return { 
        success: false, 
        error: `Wallet name "${newName}" already exists. Please choose a different name.` 
      };
    }
    
    const updatedWallets = wallets.map(w => 
      w.id === id ? { ...w, name: newName.trim() } : w
    );
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWallets));
      set({ wallets: updatedWallets });
      return { success: true };
    } catch (error) {
      console.error('[MultiWallet] Rename wallet error:', error);
      return { success: false, error: 'Failed to rename wallet' };
    }
  },

  updateWalletAddresses: async (id: string, addresses: Partial<Pick<WalletInfo, 'evmAddress' | 'solanaAddress' | 'suiAddress' | 'tronAddress'>>) => {
    const { wallets } = get();
    
    const updatedWallets = wallets.map(w => 
      w.id === id ? { ...w, ...addresses } : w
    );
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWallets));
      set({ wallets: updatedWallets });
    } catch (error) {
      console.error('[MultiWallet] Update addresses error:', error);
    }
  },
}));
