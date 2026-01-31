// packages/shared/src/configService.ts

import {
  Chain,
  Token,
  ConfigVersion,
  ChainsResponse,
  TokensResponse,
} from './types';

// Import local data for fallback
import chainsData from './data/chains.json';
import tokensData from './data/tokens.json';

const LOCAL_CHAINS: Chain[] = chainsData.chains as Chain[];
const LOCAL_TOKENS: Token[] = tokensData.tokens as Token[];
const LOCAL_VERSION: ConfigVersion = {
  chains: '2026-01-24T00:00:00Z',
  tokens: '2026-01-24T00:00:00Z',
  version: '1.0.0',
};

export interface ConfigServiceOptions {
  apiBaseUrl: string;
  cacheTimeout?: number;
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  onError?: (error: Error) => void;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  version: string;
}

const CACHE_KEYS = {
  chains: 'omniswap_chains_cache',
  tokens: 'omniswap_tokens_cache',
  version: 'omniswap_config_version',
};

export class ConfigService {
  private apiBaseUrl: string;
  private cacheTimeout: number;
  private storage: ConfigServiceOptions['storage'];
  private onError?: (error: Error) => void;

  // In-memory cache
  private chainsCache: CachedData<Chain[]> | null = null;
  private tokensCache: Map<string, CachedData<Token[]>> = new Map();

  constructor(options: ConfigServiceOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000;
    this.storage = options.storage;
    this.onError = options.onError;
  }

  // ============ Chains ============
  async getChains(): Promise<Chain[]> {
    // Check in-memory cache first
    if (this.chainsCache && this.isCacheValid(this.chainsCache.timestamp)) {
      return this.chainsCache.data;
    }

    // Check persistent storage
    if (this.storage) {
      try {
        const cached = await this.storage.getItem(CACHE_KEYS.chains);
        if (cached) {
          const parsed = JSON.parse(cached) as CachedData<Chain[]>;
          if (this.isCacheValid(parsed.timestamp)) {
            this.chainsCache = parsed;
            return parsed.data;
          }
        }
      } catch (e) {
        // Ignore storage errors
      }
    }

    // Fetch from API
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/api/v1/config/chains`
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = (await response.json()) as ChainsResponse;
      const chains = data.chains;

      // Update caches
      const cacheData: CachedData<Chain[]> = {
        data: chains,
        timestamp: Date.now(),
        version: data.version,
      };

      this.chainsCache = cacheData;

      if (this.storage) {
        await this.storage.setItem(CACHE_KEYS.chains, JSON.stringify(cacheData));
      }

      return chains;
    } catch (error) {
      this.onError?.(error as Error);
      console.warn('Failed to fetch chains from API, using local fallback');
      return LOCAL_CHAINS;
    }
  }

  async getChainById(chainId: number | string): Promise<Chain | undefined> {
    const chains = await this.getChains();
    return chains.find(
      (chain) => chain.id === chainId || chain.id.toString() === chainId.toString()
    );
  }

  async searchChains(query: string): Promise<Chain[]> {
    const chains = await this.getChains();
    const q = query.toLowerCase().trim();
    if (!q) return chains;

    return chains.filter(
      (chain) =>
        chain.name.toLowerCase().includes(q) ||
        chain.symbol.toLowerCase().includes(q) ||
        chain.id.toString().includes(q)
    );
  }

  // ============ Tokens ============
  async getTokens(chainId?: number | string): Promise<Token[]> {
    const cacheKey = chainId ? `tokens_${chainId}` : 'tokens_all';

    // Check in-memory cache
    const memCache = this.tokensCache.get(cacheKey);
    if (memCache && this.isCacheValid(memCache.timestamp)) {
      return memCache.data;
    }

    // Check persistent storage
    if (this.storage) {
      try {
        const storageKey = `${CACHE_KEYS.tokens}_${cacheKey}`;
        const cached = await this.storage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as CachedData<Token[]>;
          if (this.isCacheValid(parsed.timestamp)) {
            this.tokensCache.set(cacheKey, parsed);
            return parsed.data;
          }
        }
      } catch (e) {
        // Ignore storage errors
      }
    }

    // Fetch from API
    try {
      const url = chainId
        ? `${this.apiBaseUrl}/api/v1/config/tokens?chainId=${chainId}`
        : `${this.apiBaseUrl}/api/v1/config/tokens`;

      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = (await response.json()) as TokensResponse;
      const tokens = data.tokens;

      // Update caches
      const cacheData: CachedData<Token[]> = {
        data: tokens,
        timestamp: Date.now(),
        version: data.version,
      };

      this.tokensCache.set(cacheKey, cacheData);

      if (this.storage) {
        const storageKey = `${CACHE_KEYS.tokens}_${cacheKey}`;
        await this.storage.setItem(storageKey, JSON.stringify(cacheData));
      }

      return tokens;
    } catch (error) {
      this.onError?.(error as Error);
      console.warn('Failed to fetch tokens from API, using local fallback');

      if (chainId) {
        return LOCAL_TOKENS.filter(
          (token) =>
            token.chainId === chainId ||
            token.chainId.toString() === chainId.toString()
        );
      }
      return LOCAL_TOKENS;
    }
  }

  async getTokensByChainId(chainId: number | string): Promise<Token[]> {
    const tokens = await this.getTokens(chainId);
    return tokens.sort((a, b) => b.popularity - a.popularity);
  }

  async getTokenByAddress(
    chainId: number | string,
    address: string
  ): Promise<Token | undefined> {
    const tokens = await this.getTokensByChainId(chainId);
    return tokens.find(
      (token) => token.address.toLowerCase() === address.toLowerCase()
    );
  }

  async searchTokens(chainId: number | string, query: string): Promise<Token[]> {
    const tokens = await this.getTokensByChainId(chainId);
    const q = query.toLowerCase().trim();
    if (!q) return tokens;

    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        token.address.toLowerCase().includes(q)
    );
  }

  async getNativeToken(chainId: number | string): Promise<Token | undefined> {
    const tokens = await this.getTokensByChainId(chainId);
    return tokens.find((token) => token.address === 'native');
  }

  // ============ Version Check ============
  async checkForUpdates(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/api/v1/config/version`
      );

      if (!response.ok) return false;

      const remoteVersion = (await response.json()) as ConfigVersion;

      const needsUpdate =
        remoteVersion.version !== LOCAL_VERSION.version ||
        remoteVersion.chains !== LOCAL_VERSION.chains ||
        remoteVersion.tokens !== LOCAL_VERSION.tokens;

      if (needsUpdate) {
        this.clearCache();
      }

      return needsUpdate;
    } catch (error) {
      return false;
    }
  }

  // ============ Cache Management ============
  clearCache(): void {
    this.chainsCache = null;
    this.tokensCache.clear();

    if (this.storage) {
      Promise.all([
        this.storage.setItem(CACHE_KEYS.chains, ''),
        this.storage.setItem(CACHE_KEYS.tokens, ''),
      ]).catch(() => {});
    }
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  private async fetchWithTimeout(
    url: string,
    timeout: number = 5000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============ Sync helpers for local fallback ============
  getLocalChains(): Chain[] {
    return LOCAL_CHAINS;
  }

  getLocalTokens(chainId?: number | string): Token[] {
    if (chainId) {
      return LOCAL_TOKENS.filter(
        (token) =>
          token.chainId === chainId ||
          token.chainId.toString() === chainId.toString()
      );
    }
    return LOCAL_TOKENS;
  }
}

export function createConfigService(
  options: ConfigServiceOptions
): ConfigService {
  return new ConfigService(options);
}
