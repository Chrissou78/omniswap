import { create } from 'zustand';
import { secureStorage } from '../services/wallet/secureStorage';
import { walletCore } from '../services/wallet/walletCore';

export interface WalletInfo {
  id: string;
  name: string;
  evmAddress: string;
  solanaAddress: string;
  suiAddress: string;
  tronAddress: string;
  createdAt: number;
}

interface WalletState {
  wallets: WalletInfo[];
  activeWalletId: string | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  biometricsAvailable: boolean;
}

interface WalletActions {
  initialize: () => Promise<void>;
  authenticate: () => Promise<boolean>;
  createWallet: (name: string) => Promise<WalletInfo | null>;
  importWallet: (name: string, mnemonic: string) => Promise<WalletInfo | null>;
  removeWallet: (id: string) => Promise<boolean>;
  setActiveWallet: (id: string) => void;
  getActiveWallet: () => WalletInfo | null;
  getMnemonic: (walletId: string) => Promise<string | null>;
  lock: () => Promise<void>;
  deleteAllData: () => Promise<void>;
  shortenAddress: (address: string | undefined) => string;
  getAddressForChain: (chainType: string) => string | null;
}

export const useWalletStore = create<WalletState & WalletActions>((set, get) => ({
  wallets: [],
  activeWalletId: null,
  isInitialized: false,
  isAuthenticated: false,
  biometricsAvailable: false,

  initialize: async () => {
    try {
      console.log('[WalletStore] Initializing...');
      
      const biometricsAvailable = await secureStorage.checkBiometrics();
      console.log('[WalletStore] Biometrics available:', biometricsAvailable);
      
      const hasWallets = await secureStorage.hasWallets();
      console.log('[WalletStore] Has wallets:', hasWallets);

      set({ 
        isInitialized: true, 
        biometricsAvailable,
      });
    } catch (error) {
      console.error('[WalletStore] Init error:', error);
      set({ isInitialized: true });
    }
  },

  authenticate: async () => {
    try {
      console.log('[WalletStore] Authenticating...');
      
      const result = await secureStorage.authenticateAndLoad();
      
      if (result.success && result.wallets) {
        console.log('[WalletStore] Authenticated, wallets:', result.wallets.length);
        
        // Debug: log wallet addresses
        if (result.wallets.length > 0) {
          console.log('[WalletStore] First wallet addresses:', {
            evm: result.wallets[0].evmAddress,
            solana: result.wallets[0].solanaAddress,
            sui: result.wallets[0].suiAddress,
            tron: result.wallets[0].tronAddress,
          });
        }
        
        set({ 
          wallets: result.wallets,
          activeWalletId: result.wallets.length > 0 ? result.wallets[0].id : null,
          isAuthenticated: true,
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[WalletStore] Auth error:', error);
      return false;
    }
  },

  createWallet: async (name: string) => {
    try {
      console.log('[WalletStore] Creating wallet:', name);
      
      // Generate mnemonic
      const mnemonic = walletCore.generateMnemonic();
      console.log('[WalletStore] Mnemonic generated');
      
      // Derive addresses using deriveWallets (correct method name!)
      const account = await walletCore.deriveWallets(mnemonic, 0);
      
      console.log('[WalletStore] Derived addresses:', {
        evm: account.evm?.address,
        solana: account.solana?.address,
        sui: account.sui?.address,
        tron: account.tron?.address,
      });

      // Create wallet info
      const walletInfo: WalletInfo = {
        id: `wallet_${Date.now()}`,
        name,
        evmAddress: account.evm?.address || '',
        solanaAddress: account.solana?.address || '',
        suiAddress: account.sui?.address || '',
        tronAddress: account.tron?.address || '',
        createdAt: Date.now(),
      };

      // Save to secure storage
      const saved = await secureStorage.addWallet(walletInfo, mnemonic);
      
      if (saved) {
        const currentWallets = get().wallets;
        const newWallets = [...currentWallets, walletInfo];
        
        set({ 
          wallets: newWallets,
          activeWalletId: walletInfo.id,
        });
        
        console.log('[WalletStore] Wallet created successfully');
        return walletInfo;
      }
      
      return null;
    } catch (error) {
      console.error('[WalletStore] Create wallet error:', error);
      return null;
    }
  },

  importWallet: async (name: string, mnemonic: string) => {
    try {
      console.log('[WalletStore] Importing wallet:', name);
      
      // Validate mnemonic
      if (!walletCore.validateMnemonic(mnemonic)) {
        console.error('[WalletStore] Invalid mnemonic');
        return null;
      }

      // Derive addresses using deriveWallets (correct method name!)
      const account = await walletCore.deriveWallets(mnemonic.trim(), 0);

      console.log('[WalletStore] Derived addresses:', {
        evm: account.evm?.address,
        solana: account.solana?.address,
        sui: account.sui?.address,
        tron: account.tron?.address,
      });

      const walletInfo: WalletInfo = {
        id: `wallet_${Date.now()}`,
        name,
        evmAddress: account.evm?.address || '',
        solanaAddress: account.solana?.address || '',
        suiAddress: account.sui?.address || '',
        tronAddress: account.tron?.address || '',
        createdAt: Date.now(),
      };

      // Save to secure storage
      const saved = await secureStorage.addWallet(walletInfo, mnemonic.trim());
      
      if (saved) {
        const currentWallets = get().wallets;
        const newWallets = [...currentWallets, walletInfo];
        
        set({ 
          wallets: newWallets,
          activeWalletId: walletInfo.id,
        });
        
        console.log('[WalletStore] Wallet imported successfully');
        return walletInfo;
      }
      
      return null;
    } catch (error) {
      console.error('[WalletStore] Import wallet error:', error);
      return null;
    }
  },

  removeWallet: async (id: string) => {
    try {
      console.log('[WalletStore] Removing wallet:', id);
      
      const success = await secureStorage.removeWallet(id);
      
      if (success) {
        const currentWallets = get().wallets;
        const newWallets = currentWallets.filter(w => w.id !== id);
        const currentActiveId = get().activeWalletId;
        
        set({ 
          wallets: newWallets,
          activeWalletId: currentActiveId === id 
            ? (newWallets.length > 0 ? newWallets[0].id : null)
            : currentActiveId,
        });
        
        console.log('[WalletStore] Wallet removed successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[WalletStore] Remove wallet error:', error);
      return false;
    }
  },

  setActiveWallet: (id: string) => {
    const wallets = get().wallets;
    const wallet = wallets.find(w => w.id === id);
    if (wallet) {
      console.log('[WalletStore] Setting active wallet:', id);
      set({ activeWalletId: id });
    }
  },

  getActiveWallet: () => {
    const { wallets, activeWalletId } = get();
    return wallets.find(w => w.id === activeWalletId) || null;
  },

  getMnemonic: async (walletId: string) => {
    try {
      return await secureStorage.getMnemonic(walletId);
    } catch (error) {
      console.error('[WalletStore] Get mnemonic error:', error);
      return null;
    }
  },

  lock: async () => {
    console.log('[WalletStore] Locking...');
    set({ 
      isAuthenticated: false,
      wallets: [],
      activeWalletId: null,
    });
    await secureStorage.lock();
  },

  deleteAllData: async () => {
    try {
      await secureStorage.deleteAllData();
      set({
        wallets: [],
        activeWalletId: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('[WalletStore] Delete all data error:', error);
    }
  },

  shortenAddress: (address: string | undefined) => {
    if (!address) return '';
    if (address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },

  getAddressForChain: (chainType: string) => {
    const wallet = get().getActiveWallet();
    if (!wallet) return null;

    switch (chainType.toLowerCase()) {
      case 'evm':
      case 'ethereum':
        return wallet.evmAddress;
      case 'solana':
        return wallet.solanaAddress;
      case 'sui':
        return wallet.suiAddress;
      case 'tron':
        return wallet.tronAddress;
      default:
        return wallet.evmAddress;
    }
  },
}));

// Compatibility export
export const walletStore = {
  initialize: () => useWalletStore.getState().initialize(),
  authenticate: () => useWalletStore.getState().authenticate(),
  createWallet: (name: string) => useWalletStore.getState().createWallet(name),
  importWallet: (name: string, mnemonic: string) => useWalletStore.getState().importWallet(name, mnemonic),
  lock: () => useWalletStore.getState().lock(),
};
