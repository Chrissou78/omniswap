// apps/web/src/lib/serverPrice.ts
//
// Server-safe token pricing for API routes and the alert cron.
//
// WHY THIS EXISTS: apps/web/src/services/priceService.ts is marked
// 'use client', so importing it from a Route Handler isn't reliable - the
// first version of the alerts routes did that and returned 500s in
// production. This module has no client-only assumptions.
//
// Primary source is DefiLlama (keyed by each chain's defillamaId, already in
// chains.json), with DexScreener as a fallback that is filtered to the
// requested chain so an unrelated same-symbol token on another chain can't be
// mistaken for the real one.

import chainsData from '@/config/chains.json';

export interface ServerTokenPrice {
  priceUsd: number;
  change24h?: number;
  source: string;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { price: ServerTokenPrice; at: number }>();

const NATIVE_SENTINELS = new Set([
  'native',
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase(),
]);

function getChainConfig(chainId: string | number) {
  return (chainsData.chains as any[]).find(
    (c) => String(c.id) === String(chainId)
  );
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the address to price a chain's native asset by. EVM chains accept the
 * zero address on DefiLlama; non-EVM chains (Solana, Sui) need their wrapped
 * native coin address instead, which chains.json already records.
 */
function resolveNativeAddress(chain: any): string | null {
  if (!chain) return null;
  if (chain.type === 'evm') return '0x0000000000000000000000000000000000000000';
  return chain.wrappedNativeAddress || null;
}

async function fromDefiLlama(
  chainId: string | number,
  tokenAddress: string
): Promise<ServerTokenPrice | null> {
  const chain = getChainConfig(chainId);
  const slug = chain?.defillamaId;
  if (!slug) return null;

  const isNative = NATIVE_SENTINELS.has(tokenAddress.toLowerCase());
  const address = isNative ? resolveNativeAddress(chain) : tokenAddress;
  if (!address) return null;

  const data = await fetchJson(
    `https://coins.llama.fi/prices/current/${slug}:${address}`
  );
  const entry = data?.coins?.[`${slug}:${address}`];
  if (!entry || typeof entry.price !== 'number') return null;

  return { priceUsd: entry.price, source: 'defillama' };
}

async function fromDexScreener(
  chainId: string | number,
  tokenAddress: string
): Promise<ServerTokenPrice | null> {
  if (NATIVE_SENTINELS.has(tokenAddress.toLowerCase())) return null;

  const chain = getChainConfig(chainId);
  const dexChain = chain?.dexscreenerId;

  const data = await fetchJson(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
  );
  const pairs: any[] = data?.pairs || [];
  if (pairs.length === 0) return null;

  // Two filters, both load-bearing:
  //  1. chainId - DexScreener returns same-address matches across chains, which
  //     would otherwise price a completely different token.
  //  2. baseToken - `priceUsd` is the price of the pair's BASE token. Without
  //     this check a pair where our token is the QUOTE side returns the other
  //     token's price (this really happened: USDC on Base priced at ~$0.41).
  const wanted = tokenAddress.toLowerCase();
  const candidates = dexChain
    ? pairs.filter(
        (p) => p.chainId === dexChain && p.baseToken?.address?.toLowerCase() === wanted
      )
    : [];
  if (candidates.length === 0) return null;

  // Deepest liquidity is the most reliable quote.
  candidates.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const best = candidates[0];
  const priceUsd = parseFloat(best.priceUsd);
  if (!Number.isFinite(priceUsd)) return null;

  return {
    priceUsd,
    change24h: typeof best.priceChange?.h24 === 'number' ? best.priceChange.h24 : undefined,
    source: 'dexscreener',
  };
}

/**
 * Real USD price for a token, or null if no source could price it.
 * Never invents a value.
 */
export async function getServerTokenPrice(
  chainId: string | number,
  tokenAddress: string
): Promise<ServerTokenPrice | null> {
  const key = `${chainId}:${tokenAddress}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.price;

  // DexScreener first for non-native tokens: it also gives 24h change, which
  // the alerts UI displays. DefiLlama is the more reliable fallback.
  const price =
    (await fromDexScreener(chainId, tokenAddress)) ??
    (await fromDefiLlama(chainId, tokenAddress));

  if (price) cache.set(key, { price, at: Date.now() });
  return price;
}
