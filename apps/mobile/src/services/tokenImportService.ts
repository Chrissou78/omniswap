import AsyncStorage from '@react-native-async-storage/async-storage';

const IMPORTED_TOKENS_KEY = 'OMNISWAP_IMPORTED_TOKENS';

// Define Token interface locally to avoid circular dependency
export interface ImportedToken {
  chainId: string | number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  isNative?: boolean;
}

export interface ChainInfo {
  id: string | number;
  type: string;
  dexscreenerId?: string;
  coingeckoAssetPlatform?: string;
  rpcDefault?: string;
  trustwalletId?: string;
}

class TokenImportService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[TokenImport] Initialized');
  }

  isValidAddress(address: string, chainType: string): boolean {
    if (!address) return false;
    
    switch (chainType) {
      case 'evm':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'solana':
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case 'sui':
        return address.startsWith('0x') && address.includes('::');
      case 'tron':
        return /^T[a-zA-Z0-9]{33}$/.test(address);
      default:
        return false;
    }
  }

  async importToken(address: string, chain: ChainInfo): Promise<ImportedToken> {
    // Fetch token info based on chain type
    let tokenInfo: Partial<ImportedToken> = {};

    try {
      switch (chain.type) {
        case 'evm':
          tokenInfo = await this.fetchEVMTokenInfo(address, chain);
          break;
        case 'solana':
          tokenInfo = await this.fetchSolanaTokenInfo(address);
          break;
        case 'sui':
          tokenInfo = await this.fetchSUITokenInfo(address);
          break;
        case 'tron':
          tokenInfo = await this.fetchTronTokenInfo(address);
          break;
        default:
          throw new Error(`Unsupported chain type: ${chain.type}`);
      }
    } catch (error) {
      console.error('[TokenImport] Fetch error:', error);
    }

    // Try to get more info from DexScreener
    if (!tokenInfo.symbol || !tokenInfo.name) {
      try {
        const dexInfo = await this.fetchDexScreenerInfo(address, chain.dexscreenerId);
        if (dexInfo) {
          tokenInfo = { ...tokenInfo, ...dexInfo };
        }
      } catch (error) {
        console.error('[TokenImport] DexScreener fetch error:', error);
      }
    }

    // Try CoinGecko as fallback for EVM
    if ((!tokenInfo.symbol || !tokenInfo.name) && chain.type === 'evm' && chain.coingeckoAssetPlatform) {
      try {
        const cgInfo = await this.fetchCoinGeckoInfo(address, chain.coingeckoAssetPlatform);
        if (cgInfo) {
          tokenInfo = { ...tokenInfo, ...cgInfo };
        }
      } catch (error) {
        console.error('[TokenImport] CoinGecko fetch error:', error);
      }
    }

    // Build token object
    const token: ImportedToken = {
      chainId: chain.id,
      address: address,
      symbol: tokenInfo.symbol || 'UNKNOWN',
      name: tokenInfo.name || `Token ${address.slice(0, 8)}...`,
      decimals: tokenInfo.decimals || 18,
      logoURI: tokenInfo.logoURI || '',
      tags: ['custom'],
      isNative: false,
    };

    return token;
  }

  // This method is no longer needed since configService handles storage
  // Keeping for backwards compatibility but it's a no-op
  async saveImportedToken(token: ImportedToken, chainId: string | number): Promise<void> {
    // Storage is now handled by configService.addCustomToken
    console.log('[TokenImport] Token will be saved by configService:', token.symbol);
  }

  // This method is no longer needed since configService handles storage
  async removeToken(address: string, chainId: string | number): Promise<void> {
    // Removal is now handled by configService.removeCustomToken
    console.log('[TokenImport] Token will be removed by configService:', address);
  }

  // No longer needed - configService handles this
  getCustomTokens(chainId: string | number): ImportedToken[] {
    return [];
  }

  private async fetchEVMTokenInfo(address: string, chain: ChainInfo): Promise<Partial<ImportedToken>> {
    return { decimals: 18 };
  }

  private async fetchSolanaTokenInfo(address: string): Promise<Partial<ImportedToken>> {
    try {
      const response = await fetch(`https://token.jup.ag/strict`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const tokens = await response.json();
        const token = tokens.find((t: any) => t.address === address);
        if (token) {
          return {
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI,
          };
        }
      }
    } catch (error) {
      console.error('[TokenImport] Solana fetch error:', error);
    }
    return { decimals: 9 };
  }

  private async fetchSUITokenInfo(address: string): Promise<Partial<ImportedToken>> {
    const parts = address.split('::');
    if (parts.length === 3) {
      return {
        symbol: parts[2],
        name: parts[2],
        decimals: 9,
      };
    }
    return { decimals: 9 };
  }

  private async fetchTronTokenInfo(address: string): Promise<Partial<ImportedToken>> {
    try {
      const response = await fetch(`https://apilist.tronscanapi.com/api/token_trc20?contract=${address}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.trc20_tokens && data.trc20_tokens.length > 0) {
          const token = data.trc20_tokens[0];
          return {
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.icon_url,
          };
        }
      }
    } catch (error) {
      console.error('[TokenImport] Tron fetch error:', error);
    }
    return { decimals: 6 };
  }

  private async fetchDexScreenerInfo(address: string, chainId?: string): Promise<Partial<ImportedToken> | null> {
    try {
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodedAddress}`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data.pairs || data.pairs.length === 0) return null;

      let pairs = data.pairs;
      if (chainId) {
        const chainPairs = pairs.filter((p: any) => p.chainId === chainId);
        if (chainPairs.length > 0) {
          pairs = chainPairs;
        }
      }

      pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      const bestPair = pairs[0];
      
      const isBaseToken = bestPair.baseToken.address.toLowerCase() === address.toLowerCase();
      const tokenInfo = isBaseToken ? bestPair.baseToken : bestPair.quoteToken;

      return {
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        logoURI: bestPair.info?.imageUrl || '',
      };
    } catch (error) {
      return null;
    }
  }

  private async fetchCoinGeckoInfo(address: string, platform: string): Promise<Partial<ImportedToken> | null> {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address.toLowerCase()}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      return {
        symbol: data.symbol?.toUpperCase(),
        name: data.name,
        decimals: data.detail_platforms?.[platform]?.decimal_place || 18,
        logoURI: data.image?.small || data.image?.thumb || '',
      };
    } catch (error) {
      return null;
    }
  }
}

export const tokenImportService = new TokenImportService();
