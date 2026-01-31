import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEYS = {
  WALLETS_DATA: 'omniswap_wallets_data',
  MNEMONICS: 'omniswap_mnemonics',
  APP_SETUP: 'omniswap_app_setup',
};

interface StoredWallet {
  id: string;
  name: string;
  evmAddress: string;
  solanaAddress: string;
  suiAddress: string;
  tronAddress: string;
  createdAt: number;
}

interface StoredMnemonics {
  [walletId: string]: string;
}

class SecureStorage {
  private wallets: StoredWallet[] = [];
  private mnemonics: StoredMnemonics = {};
  private isLoaded = false;

  async checkBiometrics(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  }

  async hasWallets(): Promise<boolean> {
    try {
      const data = await SecureStore.getItemAsync(KEYS.WALLETS_DATA);
      if (data) {
        const wallets = JSON.parse(data);
        return Array.isArray(wallets) && wallets.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }

  async authenticateAndLoad(): Promise<{ success: boolean; wallets: StoredWallet[] }> {
    try {
      // Authenticate with biometrics
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallets',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        console.log('[SecureStorage] Biometric auth failed');
        return { success: false, wallets: [] };
      }

      // Load wallets
      const walletsData = await SecureStore.getItemAsync(KEYS.WALLETS_DATA);
      const mnemonicsData = await SecureStore.getItemAsync(KEYS.MNEMONICS);

      if (walletsData) {
        this.wallets = JSON.parse(walletsData);
      } else {
        this.wallets = [];
      }

      if (mnemonicsData) {
        this.mnemonics = JSON.parse(mnemonicsData);
      } else {
        this.mnemonics = {};
      }

      this.isLoaded = true;
      
      console.log('[SecureStorage] Loaded wallets:', this.wallets.length);
      
      // Debug log
      if (this.wallets.length > 0) {
        console.log('[SecureStorage] First wallet:', {
          id: this.wallets[0].id,
          name: this.wallets[0].name,
          evmAddress: this.wallets[0].evmAddress,
          solanaAddress: this.wallets[0].solanaAddress,
        });
      }

      return { success: true, wallets: this.wallets };
    } catch (error) {
      console.error('[SecureStorage] Auth and load error:', error);
      return { success: false, wallets: [] };
    }
  }

  async addWallet(wallet: StoredWallet, mnemonic: string): Promise<boolean> {
    try {
      // Add to arrays
      this.wallets.push(wallet);
      this.mnemonics[wallet.id] = mnemonic;

      // Save to secure storage
      await SecureStore.setItemAsync(KEYS.WALLETS_DATA, JSON.stringify(this.wallets));
      await SecureStore.setItemAsync(KEYS.MNEMONICS, JSON.stringify(this.mnemonics));

      console.log('[SecureStorage] Wallet saved:', wallet.id);
      console.log('[SecureStorage] Wallet addresses saved:', {
        evm: wallet.evmAddress,
        solana: wallet.solanaAddress,
      });

      return true;
    } catch (error) {
      console.error('[SecureStorage] Add wallet error:', error);
      return false;
    }
  }

  async removeWallet(walletId: string): Promise<boolean> {
    try {
      this.wallets = this.wallets.filter(w => w.id !== walletId);
      delete this.mnemonics[walletId];

      await SecureStore.setItemAsync(KEYS.WALLETS_DATA, JSON.stringify(this.wallets));
      await SecureStore.setItemAsync(KEYS.MNEMONICS, JSON.stringify(this.mnemonics));

      console.log('[SecureStorage] Wallet removed:', walletId);
      return true;
    } catch (error) {
      console.error('[SecureStorage] Remove wallet error:', error);
      return false;
    }
  }

  async getMnemonic(walletId: string): Promise<string | null> {
    // Re-authenticate before showing mnemonic
    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to view recovery phrase',
        fallbackLabel: 'Use PIN',
      });

      if (!authResult.success) {
        return null;
      }

      return this.mnemonics[walletId] || null;
    } catch {
      return null;
    }
  }

  async lock(): Promise<void> {
    this.wallets = [];
    this.mnemonics = {};
    this.isLoaded = false;
  }

  async deleteAllData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.WALLETS_DATA);
      await SecureStore.deleteItemAsync(KEYS.MNEMONICS);
      await SecureStore.deleteItemAsync(KEYS.APP_SETUP);
      this.wallets = [];
      this.mnemonics = {};
      this.isLoaded = false;
    } catch (error) {
      console.error('[SecureStorage] Delete all error:', error);
    }
  }

  getWallets(): StoredWallet[] {
    return this.wallets;
  }
}

export const secureStorage = new SecureStorage();
