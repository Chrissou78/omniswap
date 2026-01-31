// apps/web/src/services/priceService.ts
'use client';

import chainsData from '@/config/chains.json';
import tokensData from '@/config/tokens.json';
import type { Chain, Token } from '@/types';

export interface TokenPrice {
  priceUsd: number;
  change24h?: number;
  volume24h?: number;
  liquidity?: number;
  marketCap?: number;
  source: string;
  timestamp: number;
}

// Cache for prices
const PRICE_CACHE = new Map<string, { price: TokenPrice; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

// ============================================================================
// DYNAMIC CHAIN HELPERS (from chains.json)
// ============================================================================

const CHAINS = chainsData.chains as Chain[];
const TOKENS = tokensData.tokens as Token[];

/**
 * Get chain from chains.json
 */
function getChain(chainId: string | number): Chain | null {
  return CHAINS.find(c => 
    c.id === chainId || String(c.id) === String(chainId)
  ) || null;
}

/**
 * Get DexScreener chain ID from chains.json
 * Uses dexscreenerId field - must be set in chains.json
 */
function getDexScreenerChain(chainId: string | number): string | null {
  const chain = getChain(chainId);
  return (chain as any)?.dexscreenerId || null;
}

/**
 * Get DefiLlama chain ID from chains.json
 * Uses defillamaId field - must be set in chains.json
 */
function getDefiLlamaChain(chainId: string | number): string | null {
  const chain = getChain(chainId);
  return (chain as any)?.defillamaId || null;
}

/**
 * Get CoinGecko asset platform ID from chains.json
 */
function getCoinGeckoAssetPlatform(chainId: string | number): string | null {
  const chain = getChain(chainId);
  return (chain as any)?.coingeckoAssetPlatform || null;
}

/**
 * Get wrapped native token address from chains.json or tokens.json
 */
function getWrappedNativeAddress(chainId: string | number): string | null {
  const chain = getChain(chainId);
  if ((chain as any)?.wrappedNativeAddress) {
    return (chain as any).wrappedNativeAddress;
  }
  
  // Find wrapped native token in tokens.json
  const wrappedToken = TOKENS.find(t => 
    (t.chainId === chainId || String(t.chainId) === String(chainId)) &&
    t.tags?.includes('wrapped') &&
    t.tags?.includes('native')
  );
  
  return wrappedToken?.address || null;
}

/**
 * Get CoinGecko ID from tokens.json
 */
function getCoinGeckoId(chainId: string | number, symbol: string, address?: string): string | null {
  const token = TOKENS.find(t => 
    (t.chainId === chainId || String(t.chainId) === String(chainId)) &&
    (t.symbol.toUpperCase() === symbol.toUpperCase() ||
     (address && t.address.toLowerCase() === address.toLowerCase()))
  );
  
  if ((token as any)?.coingeckoId) return (token as any).coingeckoId;
  
  // Fallback: any token with this symbol that has coingeckoId
  const anyToken = TOKENS.find(t => 
    t.symbol.toUpperCase() === symbol.toUpperCase() && (t as any).coingeckoId
  );
  
  return (anyToken as any)?.coingeckoId || null;
}

// ============================================================================
// DEXSCREENER (Primary Source)
// ============================================================================

/**
 * Fetch price from DexScreener
 * Rate limit: 300 requests/minute
 */
async function fetchDexScreenerPrice(
  chainId: string | number,
  tokenAddress: string
): Promise<TokenPrice | null> {
  const chain = getDexScreenerChain(chainId);
  if (!chain) {
    console.warn(`[Price] No dexscreenerId configured for chain ${chainId}`);
    return null;
  }
  
  // Handle native tokens
  if (!tokenAddress || tokenAddress === 'native') {
    const wrappedAddress = getWrappedNativeAddress(chainId);
    if (!wrappedAddress) return null;
    tokenAddress = wrappedAddress;
  }

  try {
    const url = `https://api.dexscreener.com/tokens/v1/${chain}/${tokenAddress}`;
    console.log(`[Price] DexScreener fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[Price] DexScreener returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(`[Price] DexScreener no pairs found for ${tokenAddress}`);
      return null;
    }
    
    // Get the pair with highest liquidity
    const bestPair = data.reduce((best: any, pair: any) => {
      const liquidity = parseFloat(pair.liquidity?.usd || '0');
      const bestLiquidity = parseFloat(best?.liquidity?.usd || '0');
      return liquidity > bestLiquidity ? pair : best;
    }, data[0]);

    if (!bestPair?.priceUsd) return null;

    console.log(`[Price] DexScreener found price: $${bestPair.priceUsd} for ${bestPair.baseToken?.symbol || tokenAddress}`);

    return {
      priceUsd: parseFloat(bestPair.priceUsd),
      change24h: bestPair.priceChange?.h24 ? parseFloat(bestPair.priceChange.h24) : undefined,
      volume24h: bestPair.volume?.h24 ? parseFloat(bestPair.volume.h24) : undefined,
      liquidity: bestPair.liquidity?.usd ? parseFloat(bestPair.liquidity.usd) : undefined,
      marketCap: bestPair.marketCap ? parseFloat(bestPair.marketCap) : undefined,
      source: `DexScreener (${bestPair.dexId || 'DEX'})`,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn(`[Price] DexScreener error for ${chain}:${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Search DexScreener by token address across all chains
 * Useful for custom tokens where we don't know the chain mapping
 */
async function searchDexScreenerByAddress(tokenAddress: string): Promise<TokenPrice | null> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    console.log(`[Price] DexScreener search by address: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    
    if (!data?.pairs || data.pairs.length === 0) return null;
    
    // Get the pair with highest liquidity
    const bestPair = data.pairs.reduce((best: any, pair: any) => {
      const liquidity = parseFloat(pair.liquidity?.usd || '0');
      const bestLiquidity = parseFloat(best?.liquidity?.usd || '0');
      return liquidity > bestLiquidity ? pair : best;
    }, data.pairs[0]);

    if (!bestPair?.priceUsd) return null;

    console.log(`[Price] DexScreener search found: $${bestPair.priceUsd} on ${bestPair.chainId}`);

    return {
      priceUsd: parseFloat(bestPair.priceUsd),
      change24h: bestPair.priceChange?.h24 ? parseFloat(bestPair.priceChange.h24) : undefined,
      volume24h: bestPair.volume?.h24 ? parseFloat(bestPair.volume.h24) : undefined,
      liquidity: bestPair.liquidity?.usd ? parseFloat(bestPair.liquidity.usd) : undefined,
      marketCap: bestPair.fdv ? parseFloat(bestPair.fdv) : undefined,
      source: `DexScreener (${bestPair.dexId || bestPair.chainId})`,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn(`[Price] DexScreener search error:`, error);
    return null;
  }
}

/**
 * Batch fetch from DexScreener (up to 30 addresses)
 */
async function fetchDexScreenerBatch(
  chainId: string | number,
  tokenAddresses: string[]
): Promise<Map<string, TokenPrice>> {
  const results = new Map<string, TokenPrice>();
  const chain = getDexScreenerChain(chainId);
  
  if (!chain || tokenAddresses.length === 0) return results;

  // DexScreener allows up to 30 addresses per request
  const chunks: string[][] = [];
  for (let i = 0; i < tokenAddresses.length; i += 30) {
    chunks.push(tokenAddresses.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    try {
      const addresses = chunk.join(',');
      const url = `https://api.dexscreener.com/tokens/v1/${chain}/${addresses}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (!data || !Array.isArray(data)) continue;

      // Group pairs by base token address
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
            source: `DexScreener (${bestPair.dexId || 'DEX'})`,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.warn(`[Price] DexScreener batch error:`, error);
    }
  }

  return results;
}

// ============================================================================
// DEFILLAMA (Fallback)
// ============================================================================

async function fetchDefiLlamaPrice(
  chainId: string | number,
  tokenAddress: string
): Promise<TokenPrice | null> {
  const chain = getDefiLlamaChain(chainId);
  if (!chain) {
    console.warn(`[Price] No defillamaId configured for chain ${chainId}`);
    return null;
  }

  // Handle native tokens
  if (!tokenAddress || tokenAddress === 'native') {
    const wrappedAddress = getWrappedNativeAddress(chainId);
    if (!wrappedAddress) return null;
    tokenAddress = wrappedAddress;
  }

  try {
    const coinId = `${chain}:${tokenAddress}`;
    console.log(`[Price] DefiLlama fetching: ${coinId}`);
    
    const response = await fetch(
      `https://coins.llama.fi/prices/current/${coinId}`,
      { next: { revalidate: 30 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const key = `${chain}:${tokenAddress}`;
    
    if (data.coins?.[key]?.price) {
      console.log(`[Price] DefiLlama found: $${data.coins[key].price}`);
      return {
        priceUsd: data.coins[key].price,
        change24h: data.coins[key].change24h,
        source: 'DefiLlama',
        timestamp: Date.now(),
      };
    }
    return null;
  } catch (error) {
    console.warn(`[Price] DefiLlama error:`, error);
    return null;
  }
}

// ============================================================================
// COINGECKO (Last resort)
// ============================================================================

async function fetchCoinGeckoPrice(geckoId: string): Promise<TokenPrice | null> {
  try {
    console.log(`[Price] CoinGecko fetching by ID: ${geckoId}`);
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data[geckoId]?.usd) {
      console.log(`[Price] CoinGecko found: $${data[geckoId].usd}`);
      return {
        priceUsd: data[geckoId].usd,
        change24h: data[geckoId].usd_24h_change,
        volume24h: data[geckoId].usd_24h_vol,
        marketCap: data[geckoId].usd_market_cap,
        source: 'CoinGecko',
        timestamp: Date.now(),
      };
    }
    return null;
  } catch (error) {
    console.warn(`[Price] CoinGecko error:`, error);
    return null;
  }
}

/**
 * Fetch price from CoinGecko by contract address
 * Useful for custom tokens
 */
async function fetchCoinGeckoByContract(
  chainId: string | number,
  tokenAddress: string
): Promise<TokenPrice | null> {
  const platform = getCoinGeckoAssetPlatform(chainId);
  if (!platform) {
    console.warn(`[Price] No coingeckoAssetPlatform configured for chain ${chainId}`);
    return null;
  }

  try {
    console.log(`[Price] CoinGecko fetching by contract: ${platform}/${tokenAddress}`);
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${tokenAddress}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const tokenData = data[tokenAddress.toLowerCase()];
    
    if (tokenData?.usd) {
      console.log(`[Price] CoinGecko contract found: $${tokenData.usd}`);
      return {
        priceUsd: tokenData.usd,
        change24h: tokenData.usd_24h_change,
        volume24h: tokenData.usd_24h_vol,
        marketCap: tokenData.usd_market_cap,
        source: 'CoinGecko',
        timestamp: Date.now(),
      };
    }
    return null;
  } catch (error) {
    console.warn(`[Price] CoinGecko contract error:`, error);
    return null;
  }
}

// ============================================================================
// MAIN PRICE FUNCTION
// ============================================================================

/**
 * Get token price with multi-source fallback
 * Priority: DexScreener → DexScreener Search → DefiLlama → CoinGecko Contract → CoinGecko ID
 */
export async function getTokenPrice(
  chainId: string | number,
  tokenAddress: string,
  symbol?: string
): Promise<TokenPrice | null> {
  const cacheKey = `${chainId}:${tokenAddress}`.toLowerCase();

  // Check cache
  const cached = PRICE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  console.log(`[Price] Fetching price for ${chainId}:${tokenAddress} (${symbol || 'unknown'})`);

  // 1. Try DexScreener first (with chain-specific endpoint)
  let price = await fetchDexScreenerPrice(chainId, tokenAddress);
  if (price) {
    PRICE_CACHE.set(cacheKey, { price, timestamp: Date.now() });
    return price;
  }

  // 2. Try DexScreener search by address (cross-chain)
  if (tokenAddress && tokenAddress !== 'native') {
    price = await searchDexScreenerByAddress(tokenAddress);
    if (price) {
      PRICE_CACHE.set(cacheKey, { price, timestamp: Date.now() });
      return price;
    }
  }

  // 3. Try DefiLlama
  price = await fetchDefiLlamaPrice(chainId, tokenAddress);
  if (price) {
    PRICE_CACHE.set(cacheKey, { price, timestamp: Date.now() });
    return price;
  }

  // 4. Try CoinGecko by contract address
  if (tokenAddress && tokenAddress !== 'native') {
    price = await fetchCoinGeckoByContract(chainId, tokenAddress);
    if (price) {
      PRICE_CACHE.set(cacheKey, { price, timestamp: Date.now() });
      return price;
    }
  }

  // 5. Try CoinGecko by ID (from tokens.json)
  if (symbol) {
    const geckoId = getCoinGeckoId(chainId, symbol, tokenAddress);
    if (geckoId) {
      price = await fetchCoinGeckoPrice(geckoId);
      if (price) {
        PRICE_CACHE.set(cacheKey, { price, timestamp: Date.now() });
        return price;
      }
    }
  }

  console.warn(`[Price] No price found for ${chainId}:${tokenAddress} (${symbol || 'unknown'})`);
  return null;
}

/**
 * Batch fetch prices for multiple tokens
 */
export async function getBatchTokenPrices(
  tokens: Array<{ chainId: string | number; address: string; symbol?: string }>
): Promise<Map<string, TokenPrice>> {
  const results = new Map<string, TokenPrice>();

  // Group by chain for batch requests
  const byChain: Record<string, Array<{ address: string; symbol?: string; chainId: string | number }>> = {};

  for (const token of tokens) {
    const key = `${token.chainId}:${token.address}`.toLowerCase();

    // Check cache first
    const cached = PRICE_CACHE.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.set(key, cached.price);
      continue;
    }

    const chainKey = String(token.chainId);
    if (!byChain[chainKey]) byChain[chainKey] = [];
    
    // Handle native tokens
    let address = token.address;
    if (!address || address === 'native') {
      const wrappedAddress = getWrappedNativeAddress(token.chainId);
      if (wrappedAddress) address = wrappedAddress;
    }
    
    if (address && address !== 'native') {
      byChain[chainKey].push({ 
        address, 
        symbol: token.symbol,
        chainId: token.chainId 
      });
    }
  }

  // Batch fetch from DexScreener
  for (const [chainId, chainTokens] of Object.entries(byChain)) {
    if (chainTokens.length === 0) continue;

    const addresses = chainTokens.map(t => t.address);
    const dexPrices = await fetchDexScreenerBatch(chainId, addresses);

    for (const token of chainTokens) {
      const dexPrice = dexPrices.get(token.address.toLowerCase());
      if (dexPrice) {
        const key = `${token.chainId}:${token.address}`.toLowerCase();
        results.set(key, dexPrice);
        PRICE_CACHE.set(key, { price: dexPrice, timestamp: Date.now() });
      }
    }
  }

  // Fallback for missing prices
  for (const token of tokens) {
    const key = `${token.chainId}:${token.address}`.toLowerCase();
    if (!results.has(key)) {
      const price = await getTokenPrice(token.chainId, token.address, token.symbol);
      if (price) {
        results.set(key, price);
      }
    }
  }

  return results;
}

/**
 * Search for token price by symbol
 */
export async function searchTokenPrice(
  chainId: string | number,
  symbol: string
): Promise<TokenPrice | null> {
  const chain = getDexScreenerChain(chainId);
  if (!chain) return null;

  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${symbol}`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    const pair = data.pairs?.find((p: any) => 
      p.chainId === chain && 
      p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase()
    );
    
    if (pair?.priceUsd) {
      return {
        priceUsd: parseFloat(pair.priceUsd),
        change24h: pair.priceChange?.h24 ? parseFloat(pair.priceChange.h24) : undefined,
        volume24h: pair.volume?.h24 ? parseFloat(pair.volume.h24) : undefined,
        liquidity: pair.liquidity?.usd ? parseFloat(pair.liquidity.usd) : undefined,
        marketCap: pair.fdv ? parseFloat(pair.fdv) : undefined,
        source: `DexScreener (${pair.dexId})`,
        timestamp: Date.now(),
      };
    }
    
    return null;
  } catch (error) {
    console.warn(`[Price] Search error for ${symbol}:`, error);
    return null;
  }
}

/**
 * Force refresh price (bypass cache)
 */
export async function refreshTokenPrice(
  chainId: string | number,
  tokenAddress: string,
  symbol?: string
): Promise<TokenPrice | null> {
  const cacheKey = `${chainId}:${tokenAddress}`.toLowerCase();
  PRICE_CACHE.delete(cacheKey);
  return getTokenPrice(chainId, tokenAddress, symbol);
}
