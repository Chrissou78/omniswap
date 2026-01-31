import { configService } from './configService';

export interface TokenPrice {
  priceUsd: number;
  change24h?: number;
  volume24h?: number;
  liquidity?: number;
  marketCap?: number;
  source: string;
  timestamp: number;
}

// Cache for prices - keyed by SYMBOL (not chainId:address)
const PRICE_CACHE = new Map<string, TokenPrice>();
const CACHE_TTL = 60000; // 1 minute
const STALE_TTL = 300000; // 5 minutes - still usable but should refresh

// Background update queue
let updateQueue: Array<{ symbol: string; chainId: string | number; address: string }> = [];
let isUpdating = false;
const BATCH_SIZE = 20;
const BATCH_DELAY = 2000; // 2 seconds between batches

// ============================================================================
// DYNAMIC CHAIN HELPERS
// ============================================================================

function getDexScreenerChain(chainId: string | number): string | null {
  const chains = configService.getChains();
  const chain = chains.find(c => c.id === chainId || String(c.id) === String(chainId));
  return (chain as any)?.dexscreenerId || null;
}

function getDefiLlamaChain(chainId: string | number): string | null {
  const chains = configService.getChains();
  const chain = chains.find(c => c.id === chainId || String(c.id) === String(chainId));
  return (chain as any)?.defillamaId || null;
}

function getWrappedNativeAddress(chainId: string | number): string | null {
  const chains = configService.getChains();
  const chain = chains.find(c => c.id === chainId || String(c.id) === String(chainId));
  
  if ((chain as any)?.wrappedNativeAddress) {
    return (chain as any).wrappedNativeAddress;
  }
  
  const tokens = configService.getTokens(chainId);
  const wrappedToken = tokens.find(t => 
    (t as any).tags?.includes('wrapped') && (t as any).tags?.includes('native')
  );
  
  return wrappedToken?.address || null;
}

function getCoinGeckoId(chainId: string | number, symbol: string): string | null {
  const tokens = configService.getTokens(chainId);
  const token = tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  if ((token as any)?.coingeckoId) return (token as any).coingeckoId;
  
  // Fallback: search all chains
  const allChains = configService.getChains();
  for (const chain of allChains) {
    const chainTokens = configService.getTokens(chain.id);
    const anyToken = chainTokens.find(t => 
      t.symbol.toUpperCase() === symbol.toUpperCase() && (t as any).coingeckoId
    );
    if ((anyToken as any)?.coingeckoId) return (anyToken as any).coingeckoId;
  }
  
  return null;
}

// ============================================================================
// DEXSCREENER
// ============================================================================

async function fetchDexScreenerPrice(
  chainId: string | number,
  tokenAddress: string
): Promise<TokenPrice | null> {
  const chain = getDexScreenerChain(chainId);
  if (!chain) return null;
  
  // Handle native tokens
  if (!tokenAddress || tokenAddress === 'native' || 
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    const wrappedAddress = getWrappedNativeAddress(chainId);
    if (!wrappedAddress) return null;
    tokenAddress = wrappedAddress;
  }

  try {
    const url = `https://api.dexscreener.com/tokens/v1/${chain}/${tokenAddress}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    
    // Get pair with highest liquidity
    const bestPair = data.reduce((best: any, pair: any) => {
      const liquidity = parseFloat(pair.liquidity?.usd || '0');
      const bestLiquidity = parseFloat(best?.liquidity?.usd || '0');
      return liquidity > bestLiquidity ? pair : best;
    }, data[0]);

    if (!bestPair?.priceUsd) return null;

    return {
      priceUsd: parseFloat(bestPair.priceUsd),
      change24h: bestPair.priceChange?.h24 ? parseFloat(bestPair.priceChange.h24) : undefined,
      volume24h: bestPair.volume?.h24 ? parseFloat(bestPair.volume.h24) : undefined,
      liquidity: bestPair.liquidity?.usd ? parseFloat(bestPair.liquidity.usd) : undefined,
      marketCap: bestPair.marketCap ? parseFloat(bestPair.marketCap) : undefined,
      source: 'DexScreener',
      timestamp: Date.now(),
    };
  } catch (error) {
    return null;
  }
}

async function fetchDexScreenerBatch(
  chainId: string | number,
  tokenAddresses: string[]
): Promise<Map<string, TokenPrice>> {
  const results = new Map<string, TokenPrice>();
  const chain = getDexScreenerChain(chainId);
  
  if (!chain || tokenAddresses.length === 0) return results;

  try {
    // DexScreener allows up to 30 addresses
    const addresses = tokenAddresses.slice(0, 30).join(',');
    const url = `https://api.dexscreener.com/tokens/v1/${chain}/${addresses}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return results;

    const data = await response.json();
    if (!data || !Array.isArray(data)) return results;

    // Group pairs by base token
    const pairsByToken: Record<string, any[]> = {};
    for (const pair of data) {
      const baseAddress = pair.baseToken?.address?.toLowerCase();
      if (baseAddress) {
        if (!pairsByToken[baseAddress]) pairsByToken[baseAddress] = [];
        pairsByToken[baseAddress].push(pair);
      }
    }

    // Get best price for each token
    for (const [address, pairs] of Object.entries(pairsByToken)) {
      const bestPair = pairs.reduce((best: any, pair: any) => {
        const liquidity = parseFloat(pair.liquidity?.usd || '0');
        const bestLiquidity = parseFloat(best?.liquidity?.usd || '0');
        return liquidity > bestLiquidity ? pair : best;
      }, pairs[0]);

      if (bestPair?.priceUsd) {
        results.set(address, {
          priceUsd: parseFloat(bestPair.priceUsd),
          change24h: bestPair.priceChange?.h24 ? parseFloat(bestPair.priceChange.h24) : undefined,
          volume24h: bestPair.volume?.h24 ? parseFloat(bestPair.volume.h24) : undefined,
          liquidity: bestPair.liquidity?.usd ? parseFloat(bestPair.liquidity.usd) : undefined,
          marketCap: bestPair.marketCap ? parseFloat(bestPair.marketCap) : undefined,
          source: 'DexScreener',
          timestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    console.warn('[Price] DexScreener batch error:', error);
  }

  return results;
}

// ============================================================================
// DEFILLAMA
// ============================================================================

async function fetchDefiLlamaBatch(
  tokens: Array<{ chainId: string | number; address: string; symbol: string }>
): Promise<Map<string, TokenPrice>> {
  const results = new Map<string, TokenPrice>();
  
  const coinIds: string[] = [];
  const symbolMap = new Map<string, string>(); // llamaKey -> symbol
  
  for (const token of tokens) {
    const chain = getDefiLlamaChain(token.chainId);
    if (!chain) continue;
    
    let address = token.address;
    if (!address || address === 'native' || 
        address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      const wrappedAddress = getWrappedNativeAddress(token.chainId);
      if (wrappedAddress) address = wrappedAddress;
      else continue;
    }
    
    const llamaKey = `${chain}:${address}`;
    coinIds.push(llamaKey);
    symbolMap.set(llamaKey.toLowerCase(), token.symbol.toUpperCase());
  }
  
  if (coinIds.length === 0) return results;
  
  try {
    const url = `https://coins.llama.fi/prices/current/${coinIds.join(',')}`;
    const response = await fetch(url);
    
    if (!response.ok) return results;
    
    const data = await response.json();
    
    for (const [llamaKey, priceData] of Object.entries(data.coins || {})) {
      const symbol = symbolMap.get(llamaKey.toLowerCase());
      if (symbol && (priceData as any)?.price) {
        results.set(symbol, {
          priceUsd: (priceData as any).price,
          change24h: (priceData as any).change24h,
          source: 'DefiLlama',
          timestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    console.warn('[Price] DefiLlama batch error:', error);
  }
  
  return results;
}

// ============================================================================
// COINGECKO (last resort)
// ============================================================================

async function fetchCoinGeckoPrice(geckoId: string): Promise<TokenPrice | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data[geckoId]?.usd) {
      return {
        priceUsd: data[geckoId].usd,
        change24h: data[geckoId].usd_24h_change,
        source: 'CoinGecko',
        timestamp: Date.now(),
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// BACKGROUND UPDATE PROCESSOR
// ============================================================================

async function processUpdateQueue() {
  if (isUpdating || updateQueue.length === 0) return;
  
  isUpdating = true;
  console.log(`[Price] Processing update queue: ${updateQueue.length} tokens`);
  
  try {
    while (updateQueue.length > 0) {
      // Take a batch
      const batch = updateQueue.splice(0, BATCH_SIZE);
      
      // Deduplicate by symbol (keep first occurrence with address)
      const uniqueBySymbol = new Map<string, typeof batch[0]>();
      for (const item of batch) {
        const key = item.symbol.toUpperCase();
        if (!uniqueBySymbol.has(key)) {
          uniqueBySymbol.set(key, item);
        }
      }
      
      const uniqueBatch = Array.from(uniqueBySymbol.values());
      console.log(`[Price] Updating batch: ${uniqueBatch.length} unique symbols`);
      
      // Group by chain for DexScreener batch
      const byChain: Record<string, typeof uniqueBatch> = {};
      for (const token of uniqueBatch) {
        const chainKey = String(token.chainId);
        if (!byChain[chainKey]) byChain[chainKey] = [];
        byChain[chainKey].push(token);
      }
      
      // Fetch from DexScreener by chain
      for (const [chainId, chainTokens] of Object.entries(byChain)) {
        const addresses = chainTokens.map(t => {
          if (!t.address || t.address === 'native' || 
              t.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
            return getWrappedNativeAddress(t.chainId) || '';
          }
          return t.address;
        }).filter(Boolean);
        
        if (addresses.length === 0) continue;
        
        const dexPrices = await fetchDexScreenerBatch(chainId, addresses);
        
        // Update cache by symbol
        for (const token of chainTokens) {
          let address = token.address;
          if (!address || address === 'native' || 
              address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
            address = getWrappedNativeAddress(token.chainId) || '';
          }
          
          const price = dexPrices.get(address.toLowerCase());
          if (price) {
            PRICE_CACHE.set(token.symbol.toUpperCase(), price);
          }
        }
      }
      
      // Try DefiLlama for missing
      const stillMissing = uniqueBatch.filter(t => {
        const cached = PRICE_CACHE.get(t.symbol.toUpperCase());
        return !cached || Date.now() - cached.timestamp > CACHE_TTL;
      });
      
      if (stillMissing.length > 0) {
        const llamaPrices = await fetchDefiLlamaBatch(stillMissing);
        for (const [symbol, price] of llamaPrices) {
          PRICE_CACHE.set(symbol, price);
        }
      }
      
      // Wait before next batch
      if (updateQueue.length > 0) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }
  } catch (error) {
    console.error('[Price] Update queue error:', error);
  } finally {
    isUpdating = false;
  }
}

// ============================================================================
// MAIN PUBLIC API
// ============================================================================

/**
 * Get prices for tokens - returns cached immediately, queues updates in background
 */
export async function getBatchTokenPrices(
  tokens: Array<{ chainId: string | number; address: string; symbol?: string }>
): Promise<Map<string, TokenPrice>> {
  const results = new Map<string, TokenPrice>();
  const needsUpdate: typeof tokens = [];
  const needsFresh: typeof tokens = [];

  console.log(`[Price] Requested prices for ${tokens.length} tokens`);

  // Deduplicate by symbol first
  const uniqueTokens = new Map<string, typeof tokens[0]>();
  for (const token of tokens) {
    if (!token.symbol) continue;
    const key = token.symbol.toUpperCase();
    if (!uniqueTokens.has(key)) {
      uniqueTokens.set(key, token);
    }
  }

  console.log(`[Price] ${uniqueTokens.size} unique symbols`);

  // Check cache and categorize
  for (const [symbol, token] of uniqueTokens) {
    const cached = PRICE_CACHE.get(symbol);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      // Always return cached value
      results.set(symbol, cached);
      
      // Queue for background update if stale
      if (age > CACHE_TTL) {
        needsUpdate.push(token);
      }
    } else {
      // No cache - needs fresh fetch
      needsFresh.push(token);
    }
  }

  console.log(`[Price] Cache hits: ${results.size}, needs fresh: ${needsFresh.length}, needs update: ${needsUpdate.length}`);

  // Fetch fresh prices immediately for tokens with no cache
  if (needsFresh.length > 0) {
    // Take first batch immediately
    const immediateBatch = needsFresh.slice(0, BATCH_SIZE);
    const laterBatch = needsFresh.slice(BATCH_SIZE);
    
    // Group by chain
    const byChain: Record<string, typeof immediateBatch> = {};
    for (const token of immediateBatch) {
      const chainKey = String(token.chainId);
      if (!byChain[chainKey]) byChain[chainKey] = [];
      byChain[chainKey].push(token);
    }
    
    // Fetch from DexScreener
    for (const [chainId, chainTokens] of Object.entries(byChain)) {
      const addresses = chainTokens.map(t => {
        if (!t.address || t.address === 'native' || 
            t.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
          return getWrappedNativeAddress(t.chainId) || '';
        }
        return t.address;
      }).filter(Boolean);
      
      if (addresses.length === 0) continue;
      
      const dexPrices = await fetchDexScreenerBatch(chainId, addresses);
      
      for (const token of chainTokens) {
        if (!token.symbol) continue;
        
        let address = token.address;
        if (!address || address === 'native' || 
            address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
          address = getWrappedNativeAddress(token.chainId) || '';
        }
        
        const price = dexPrices.get(address.toLowerCase());
        if (price) {
          const symbol = token.symbol.toUpperCase();
          PRICE_CACHE.set(symbol, price);
          results.set(symbol, price);
        }
      }
    }
    
    // Queue rest for background
    if (laterBatch.length > 0) {
      updateQueue.push(...laterBatch.map(t => ({
        symbol: t.symbol || '',
        chainId: t.chainId,
        address: t.address,
      })).filter(t => t.symbol));
    }
  }
  
  // Queue stale tokens for background update
  if (needsUpdate.length > 0) {
    updateQueue.push(...needsUpdate.map(t => ({
      symbol: t.symbol || '',
      chainId: t.chainId,
      address: t.address,
    })).filter(t => t.symbol));
  }
  
  // Start background processing
  if (updateQueue.length > 0 && !isUpdating) {
    // Don't await - run in background
    processUpdateQueue();
  }

  console.log(`[Price] Returning ${results.size} prices`);
  return results;
}

/**
 * Get single token price
 */
export async function getTokenPrice(
  chainId: string | number,
  tokenAddress: string,
  symbol?: string
): Promise<TokenPrice | null> {
  if (symbol) {
    const cached = PRICE_CACHE.get(symbol.toUpperCase());
    if (cached && Date.now() - cached.timestamp < STALE_TTL) {
      // Queue update if stale
      if (Date.now() - cached.timestamp > CACHE_TTL) {
        updateQueue.push({ symbol, chainId, address: tokenAddress });
        if (!isUpdating) processUpdateQueue();
      }
      return cached;
    }
  }

  // Fetch fresh
  let price = await fetchDexScreenerPrice(chainId, tokenAddress);
  
  if (!price) {
    // Try CoinGecko
    const geckoId = symbol ? getCoinGeckoId(chainId, symbol) : null;
    if (geckoId) {
      price = await fetchCoinGeckoPrice(geckoId);
    }
  }

  if (price && symbol) {
    PRICE_CACHE.set(symbol.toUpperCase(), price);
  }

  return price;
}

// ============================================================================
// COMPATIBILITY LAYER
// ============================================================================

class PriceService {
  async getPrice(symbol: string): Promise<number> {
    const cached = PRICE_CACHE.get(symbol.toUpperCase());
    if (cached) return cached.priceUsd;
    
    // Find token in any chain
    const chains = configService.getChains();
    for (const chain of chains) {
      const tokens = configService.getTokens(chain.id);
      const token = tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
      if (token) {
        const price = await getTokenPrice(chain.id, token.address, symbol);
        return price?.priceUsd || 0;
      }
    }
    return 0;
  }

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    
    // Collect one token per symbol
    const tokensToFetch: Array<{ chainId: string | number; address: string; symbol: string }> = [];
    const chains = configService.getChains();
    
    for (const symbol of symbols) {
      // Check cache first
      const cached = PRICE_CACHE.get(symbol.toUpperCase());
      if (cached) {
        result[symbol.toUpperCase()] = cached.priceUsd;
        continue;
      }
      
      // Find token
      for (const chain of chains) {
        const tokens = configService.getTokens(chain.id);
        const token = tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
        if (token) {
          tokensToFetch.push({
            chainId: chain.id,
            address: token.address,
            symbol: token.symbol,
          });
          break;
        }
      }
    }

    if (tokensToFetch.length > 0) {
      const prices = await getBatchTokenPrices(tokensToFetch);
      for (const [symbol, price] of prices) {
        result[symbol] = price.priceUsd;
      }
    }

    return result;
  }

  async getPricesByContracts(
    tokens: Array<{ chainId: string | number; address: string; symbol: string }>
  ): Promise<Record<string, number>> {
    const prices = await getBatchTokenPrices(tokens);
    const result: Record<string, number> = {};

    for (const token of tokens) {
      const price = prices.get(token.symbol.toUpperCase());
      if (price) {
        result[token.symbol.toUpperCase()] = price.priceUsd;
      }
    }

    return result;
  }

  getChange24h(symbol: string): number {
    const cached = PRICE_CACHE.get(symbol.toUpperCase());
    return cached?.change24h || 0;
  }

  clearCache(): void {
    PRICE_CACHE.clear();
    updateQueue = [];
  }
  
  getCachedPrice(symbol: string): number {
    const cached = PRICE_CACHE.get(symbol.toUpperCase());
    return cached?.priceUsd || 0;
  }
  
  getCacheSize(): number {
    return PRICE_CACHE.size;
  }
}

export const priceService = new PriceService();
