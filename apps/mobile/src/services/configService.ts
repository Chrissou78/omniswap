import AsyncStorage from '@react-native-async-storage/async-storage';
import chainsData from '../data/chains.json';
import tokensData from '../data/tokens.json';
import logosData from '../data/logos.json';

// Extract arrays from wrapper objects if needed
const chainsArray = Array.isArray(chainsData) ? chainsData : (chainsData as any).chains || [];
const tokensArray = Array.isArray(tokensData) ? tokensData : (tokensData as any).tokens || [];

// Logos lookup
const chainLogos: Record<string, string> = (logosData as any).chains || {};
const tokenLogos: Record<string, string> = (logosData as any).tokens || {};

export interface Chain {
  id: string | number;
  name: string;
  symbol: string;
  color?: string;
  type: string;
  trustwalletId?: string;
  dexscreenerId?: string;
  defillamaId?: string;
  coingeckoAssetPlatform?: string;
  wrappedNativeAddress?: string;
  rpcEnvKey?: string;
  rpcDefault?: string;
  explorerUrl?: string;
  explorerName?: string;
  popularity?: number;
  logoURI?: string;
}

export interface Token {
  chainId: string | number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  popularity?: number;
  isNative?: boolean;
  priceUsd?: number;
}

const STORAGE_KEYS = {
  CHAINS: 'omniswap_chains',
  TOKENS: 'omniswap_tokens',
  LAST_SYNC: 'omniswap_last_sync',
  CUSTOM_TOKENS: 'omniswap_custom_tokens',
};

const API_BASE_URL = 'http://10.0.0.170:3000';

// Helper to get chain logo from logos.json
function getChainLogo(chainId: string | number, trustwalletId?: string): string | undefined {
  // First try logos.json
  const logo = chainLogos[String(chainId)];
  if (logo) return logo;
  
  // Fallback to TrustWallet if trustwalletId exists
  if (trustwalletId) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustwalletId}/info/logo.png`;
  }
  
  return undefined;
}

// Helper to get token logo from logos.json or construct from data
function getTokenLogo(chainId: string | number, address: string, existingLogoURI?: string, trustwalletId?: string): string | undefined {
  // Build the key for logos.json lookup
  const tokenKey = `${chainId}-${address}`;
  
  // First try logos.json with exact address
  const exactLogo = tokenLogos[tokenKey];
  if (exactLogo) return exactLogo;
  
  // For native tokens, try the native key
  if (address === 'native' || address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    const nativeLogo = tokenLogos[`${chainId}-native`];
    if (nativeLogo) return nativeLogo;
  }
  
  // Use existing logoURI from tokens.json if available
  if (existingLogoURI) return existingLogoURI;
  
  // Fallback: construct TrustWallet URL for EVM tokens
  if (trustwalletId && address && address.startsWith('0x') && address.length === 42) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustwalletId}/assets/${address}/logo.png`;
  }
  
  return undefined;
}

class ConfigService {
  private chains: Chain[] = [];
  private tokensByChain: Map<string | number, Token[]> = new Map();
  private customTokens: Map<string, Token[]> = new Map(); // Separate storage for custom tokens
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[Config] Initializing...');

    // Load chains from bundled JSON with logos
    this.chains = chainsArray.map((chain: any) => ({
      ...chain,
      logoURI: getChainLogo(chain.id, chain.trustwalletId),
    }));

    console.log(`[Config] Loaded ${this.chains.length} chains from bundled data`);

    // Load tokens from bundled JSON, grouped by chainId
    const tokenMap = new Map<string | number, Token[]>();
    
    for (const token of tokensArray) {
      const chainId = token.chainId;
      const chain = this.chains.find(c => c.id === chainId || String(c.id) === String(chainId));
      
      if (!tokenMap.has(chainId)) {
        tokenMap.set(chainId, []);
      }
      
      // Determine if native token
      const isNative = token.address === 'native' || 
                       token.tags?.includes('native') ||
                       token.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      
      // Get the best logo
      const logoURI = getTokenLogo(chainId, token.address, token.logoURI, chain?.trustwalletId);
      
      tokenMap.get(chainId)!.push({
        ...token,
        isNative,
        logoURI,
        // Normalize native address for consistency
        address: token.address === 'native' ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : token.address,
      });
    }

    // Sort tokens by popularity within each chain
    for (const [chainId, tokens] of tokenMap) {
      tokens.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      this.tokensByChain.set(chainId, tokens);
    }

    console.log(`[Config] Loaded tokens for ${this.tokensByChain.size} chains`);

    // Load custom tokens from storage
    await this.loadCustomTokens();

    this.initialized = true;

    // Sync with API in background (non-blocking)
    this.syncWithAPI().catch(err => console.warn('[Config] Background sync failed:', err));
  }

  private async loadCustomTokens(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_TOKENS);
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const chainId of Object.keys(parsed)) {
          this.customTokens.set(chainId, parsed[chainId]);
        }
        console.log(`[Config] Loaded custom tokens for ${this.customTokens.size} chains`);
      }
    } catch (error) {
      console.error('[Config] Load custom tokens error:', error);
    }
  }

  private async saveCustomTokens(): Promise<void> {
    try {
      const obj: Record<string, Token[]> = {};
      for (const [chainId, tokens] of this.customTokens) {
        obj[chainId] = tokens;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_TOKENS, JSON.stringify(obj));
    } catch (error) {
      console.error('[Config] Save custom tokens error:', error);
    }
  }

  private async syncWithAPI(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Try to fetch chains from API
      const chainsResponse = await fetch(`${API_BASE_URL}/api/v1/config/chains`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeout);

      if (chainsResponse.ok) {
        const chainsResult = await chainsResponse.json();
        if (chainsResult.data && Array.isArray(chainsResult.data)) {
          // Merge API chains with local chains
          const apiChains = chainsResult.data;
          for (const apiChain of apiChains) {
            const existingIndex = this.chains.findIndex(c => c.id === apiChain.id);
            const chainWithLogo = {
              ...apiChain,
              logoURI: getChainLogo(apiChain.id, apiChain.trustwalletId),
            };
            
            if (existingIndex >= 0) {
              this.chains[existingIndex] = chainWithLogo;
            } else {
              this.chains.push(chainWithLogo);
            }
          }
          console.log(`[Config] Synced ${apiChains.length} chains from API`);
        }
      }
    } catch (error) {
      // Silent fail for background sync
      console.log('[Config] API sync skipped (offline or unavailable)');
    }
  }

  getChains(): Chain[] {
    return this.chains;
  }

  getChain(chainId: string | number): Chain | undefined {
    return this.chains.find(c => c.id === chainId || String(c.id) === String(chainId));
  }

  getTokens(chainId: string | number): Token[] {
    const chainKey = String(chainId);
    
    // Get base tokens from bundled data
    const baseTokens = this.tokensByChain.get(chainId) || 
                       this.tokensByChain.get(chainKey) || 
                       this.tokensByChain.get(Number(chainId)) || 
                       [];
    
    // Get custom imported tokens
    const customTokensList = this.customTokens.get(chainKey) || [];
    
    // Merge, avoiding duplicates (by address, case-insensitive)
    const allTokens = [...baseTokens];
    for (const custom of customTokensList) {
      const exists = allTokens.some(t => 
        t.address.toLowerCase() === custom.address.toLowerCase()
      );
      if (!exists) {
        allTokens.push(custom);
      }
    }
    
    return allTokens;
  }

  getTokenByAddress(chainId: string | number, address: string): Token | undefined {
    const tokens = this.getTokens(chainId);
    return tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
  }

  // Get logo for any chain (useful for external calls)
  getChainLogo(chainId: string | number): string | undefined {
    const chain = this.getChain(chainId);
    return chain?.logoURI || getChainLogo(chainId);
  }

  // Get logo for any token (useful for imported tokens)
  getTokenLogo(chainId: string | number, address: string): string | undefined {
    const chain = this.getChain(chainId);
    return getTokenLogo(chainId, address, undefined, chain?.trustwalletId);
  }

  // Add a custom token
  addCustomToken(token: Token): void {
    const chainKey = String(token.chainId);
    
    if (!this.customTokens.has(chainKey)) {
      this.customTokens.set(chainKey, []);
    }
    
    const tokens = this.customTokens.get(chainKey)!;
    
    // Check if already exists
    const exists = tokens.some(
      t => t.address.toLowerCase() === token.address.toLowerCase()
    );
    
    if (!exists) {
      // Ensure token has custom tag
      const tokenWithTag = {
        ...token,
        tags: [...(token.tags || []), 'custom'].filter((v, i, a) => a.indexOf(v) === i),
      };
      tokens.push(tokenWithTag);
      this.customTokens.set(chainKey, tokens);
      
      // Save to storage
      this.saveCustomTokens();
      
      console.log('[Config] Added custom token:', token.symbol, 'on chain', chainKey);
    }
  }

  // Remove a custom token
  removeCustomToken(address: string, chainId: string | number): void {
    const chainKey = String(chainId);
    
    if (this.customTokens.has(chainKey)) {
      const tokens = this.customTokens.get(chainKey)!;
      const filtered = tokens.filter(
        t => t.address.toLowerCase() !== address.toLowerCase()
      );
      this.customTokens.set(chainKey, filtered);
      
      // Save to storage
      this.saveCustomTokens();
      
      console.log('[Config] Removed custom token:', address);
    }
  }

  // Get only custom tokens for a chain
  getCustomTokens(chainId: string | number): Token[] {
    return this.customTokens.get(String(chainId)) || [];
  }

  // Check if a token is custom
  isCustomToken(chainId: string | number, address: string): boolean {
    const customList = this.customTokens.get(String(chainId)) || [];
    return customList.some(t => t.address.toLowerCase() === address.toLowerCase());
  }
}

export const configService = new ConfigService();
