// src/services/walletService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WalletState {
  address: string | null;
  chainId: number | string | null;
  isConnected: boolean;
  connector: string | null;
}

const WALLET_STORAGE_KEY = 'omniswap_wallet';

class WalletService {
  private state: WalletState = {
    address: null,
    chainId: null,
    isConnected: false,
    connector: null,
  };

  private listeners: Set<(state: WalletState) => void> = new Set();

  async initialize(): Promise<WalletState> {
    try {
      const saved = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      if (saved) {
        this.state = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load wallet state:', error);
    }
    return this.state;
  }

  getState(): WalletState {
    return this.state;
  }

  subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  async connect(address: string, chainId: number | string, connector: string): Promise<void> {
    this.state = {
      address,
      chainId,
      isConnected: true,
      connector,
    };
    await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(this.state));
    this.notify();
  }

  async disconnect(): Promise<void> {
    this.state = {
      address: null,
      chainId: null,
      isConnected: false,
      connector: null,
    };
    await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
    this.notify();
  }

  async switchChain(chainId: number | string): Promise<void> {
    this.state.chainId = chainId;
    await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(this.state));
    this.notify();
  }

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

export const walletService = new WalletService();
