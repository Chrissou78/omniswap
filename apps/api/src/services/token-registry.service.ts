// packages/core/src/services/token-registry.service.ts

import { Token } from '@omniswap/types';
import { OneInchAdapter } from '../adapters/evm/oneinch.adapter';
import { JupiterAdapter } from '../adapters/solana/jupiter.adapter';
import { CetusAdapter } from '../adapters/sui/cetus.adapter';
import { RedisClient } from '../utils/redis';

export interface TokenRegistryConfig {
  redis: RedisClient;
  oneInchAdapter?: OneInchAdapter;
  jupiterAdapter?: JupiterAdapter;
  cetusAdapter?: CetusAdapter;
  
  // Sync settings
  syncIntervalHours: number;
  
  // Callbacks
  onSyncComplete?: (source: string, count: number) => void;
}

export class TokenRegistryService {
  private config: TokenRegistryConfig;
  private tokenCache: Map<string, Token> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(config: TokenRegistryConfig) {
    this.config = config;
  }

  /**
   * Start automatic token syncing
   */
  startAutoSync(): void {
    if (this.syncInterval) return;

    // Initial sync
    this.syncAll();

    // Set up interval
    const intervalMs = this.config.syncIntervalHours * 60 * 60 * 1000;
    this.syncInterval = setInterval(() => this.syncAll(), intervalMs);

    console.log(`[TokenRegistry] Auto-sync started (every ${this.config.syncIntervalHours}h)`);
  }

  /**
   * Stop automatic syncing
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync tokens from all sources
   */
  async syncAll(): Promise<void> {
    console.log('[TokenRegistry] Starting full token sync...');

    const results = await Promise.allSettled([
      this.syncFromOneInch(),
      this.syncFromJupiter(),
      this.syncFromCetus(),
    ]);

    let totalSynced = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalSynced += result.value;
      }
    }

    console.log(`[TokenRegistry] Sync complete. Total tokens: ${totalSynced}`);
  }

  /**
   * Sync tokens from 1inch (EVM chains)
   */
  async syncFromOneInch(): Promise<number> {
    if (!this.config.oneInchAdapter) return 0;

    const chains = ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc', 'base', 'avalanche'];
    let totalTokens = 0;

    for (const chainId of chains) {
      try {
        const tokens = await this.config.oneInchAdapter.getTokens(chainId);
        await this.saveTokens(tokens);
        totalTokens += tokens.length;
        console.log(`[TokenRegistry] 1inch ${chainId}: ${tokens.length} tokens`);
      } catch (error) {
        console.error(`[TokenRegistry] 1inch ${chainId} failed:`, error);
      }
    }

    this.config.onSyncComplete?.('1inch', totalTokens);
    return totalTokens;
  }

  /**
   * Sync tokens from Jupiter (Solana)
   */
  async syncFromJupiter(): Promise<number> {
    if (!this.config.jupiterAdapter) return 0;

    try {
      // Get strict (verified) tokens for better quality
      const tokens = await this.config.jupiterAdapter.getStrictTokens();
      await this.saveTokens(tokens);
      
      console.log(`[TokenRegistry] Jupiter: ${tokens.length} tokens`);
      this.config.onSyncComplete?.('jupiter', tokens.length);
      
      return tokens.length;
    } catch (error) {
      console.error('[TokenRegistry] Jupiter sync failed:', error);
      return 0;
    }
  }

  /**
   * Sync tokens from Cetus (Sui)
   */
  async syncFromCetus(): Promise<number> {
    if (!this.config.cetusAdapter) return 0;

    try {
      const tokens = await this.config.cetusAdapter.getTokens();
      await this.saveTokens(tokens);
      
      console.log(`[TokenRegistry] Cetus: ${tokens.length} tokens`);
      this.config.onSyncComplete?.('cetus', tokens.length);
      
      return tokens.length;
    } catch (error) {
      console.error('[TokenRegistry] Cetus sync failed:', error);
      return 0;
    }
  }

  /**
   * Save tokens to cache and Redis
   */
  private async saveTokens(tokens: Token[]): Promise<void> {
    const pipeline = this.config.redis['client'].pipeline();

    for (const token of tokens) {
      const key = `${token.chainId}:${token.address.toLowerCase()}`;
      
      // Update memory cache
      this.tokenCache.set(key, token);

      // Add to Redis
      pipeline.hset(
        'tokens',
        key,
        JSON.stringify(token)
      );

      // Add to chain-specific set
      pipeline.sadd(`tokens:${token.chainId}`, token.address.toLowerCase());

      // Add to symbol index
      pipeline.sadd(`tokens:symbol:${token.symbol.toUpperCase()}`, key);
    }

    await pipeline.exec();
  }

  /**
   * Get token by chain and address
   */
  async getToken(chainId: string, address: string): Promise<Token | null> {
    const key = `${chainId}:${address.toLowerCase()}`;

    // Check memory cache
    if (this.tokenCache.has(key)) {
      return this.tokenCache.get(key)!;
    }

    // Check Redis
    const cached = await this.config.redis.hget('tokens', key);
    if (cached) {
      const token = JSON.parse(cached) as Token;
      this.tokenCache.set(key, token);
      return token;
    }

    return null;
  }

  /**
   * Search tokens
   */
  async searchTokens(
    query: string,
    options: {
      chainId?: string;
      limit?: number;
      verified?: boolean;
    } = {}
  ): Promise<Token[]> {
    const { chainId, limit = 20, verified = true } = options;
    const queryLower = query.toLowerCase();
    const results: Token[] = [];

    // Search in memory cache first
    for (const token of this.tokenCache.values()) {
      // Filter by chain
      if (chainId && token.chainId !== chainId) continue;

      // Filter by verified
      if (verified && !token.verified) continue;

      // Match query
      if (
        token.symbol.toLowerCase().includes(queryLower) ||
        token.name?.toLowerCase().includes(queryLower) ||
        token.address.toLowerCase().includes(queryLower)
      ) {
        results.push(token);
      }

      if (results.length >= limit) break;
    }

    // Sort by relevance (exact symbol match first)
    results.sort((a, b) => {
      const aExact = a.symbol.toLowerCase() === queryLower;
      const bExact = b.symbol.toLowerCase() === queryLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    return results.slice(0, limit);
  }

  /**
   * Get tokens by chain
   */
  async getTokensByChain(
    chainId: string,
    options: {
      limit?: number;
      offset?: number;
      verified?: boolean;
    } = {}
  ): Promise<Token[]> {
    const { limit = 100, offset = 0, verified = true } = options;
    const results: Token[] = [];

    for (const token of this.tokenCache.values()) {
      if (token.chainId !== chainId) continue;
      if (verified && !token.verified) continue;
      results.push(token);
    }

    // Sort by symbol
    results.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return results.slice(offset, offset + limit);
  }

  /**
   * Get popular/featured tokens
   */
  async getPopularTokens(chainId?: string): Promise<Token[]> {
    const popularSymbols = [
      'ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC',
      'SOL', 'WSOL', 'RAY', 'JUP', 'BONK',
      'SUI', 'CETUS',
      'ARB', 'OP', 'MATIC', 'BNB', 'AVAX',
    ];

    const results: Token[] = [];

    for (const symbol of popularSymbols) {
      for (const token of this.tokenCache.values()) {
        if (chainId && token.chainId !== chainId) continue;
        if (token.symbol.toUpperCase() === symbol) {
          results.push(token);
          break;
        }
      }
    }

    return results;
  }

  /**
   * Get token count
   */
  getTokenCount(chainId?: string): number {
    if (chainId) {
      return Array.from(this.tokenCache.values())
        .filter(t => t.chainId === chainId)
        .length;
    }
    return this.tokenCache.size;
  }

  /**
   * Load tokens from Redis on startup
   */
  async loadFromCache(): Promise<void> {
    const tokens = await this.config.redis.hgetall('tokens');
    
    for (const [key, value] of Object.entries(tokens)) {
      try {
        const token = JSON.parse(value) as Token;
        this.tokenCache.set(key, token);
      } catch {
        // Invalid entry
      }
    }

    console.log(`[TokenRegistry] Loaded ${this.tokenCache.size} tokens from cache`);
  }
}
