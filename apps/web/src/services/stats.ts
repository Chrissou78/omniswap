// apps/web/src/services/stats.ts
import { CHAINS, ALL_TOKENS } from '../config';

export interface SwapStats {
  tokensListed: number;
  supportedChains: number;
  totalVolume: string;
  totalVolumeRaw: number;
}

// Cached volume data
let cachedVolume: { value: number; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch total DEX volume from DefiLlama API
 */
export async function fetchTotalVolume(): Promise<number> {
  // Return cached value if fresh
  if (cachedVolume && Date.now() - cachedVolume.timestamp < CACHE_DURATION) {
    return cachedVolume.value;
  }

  try {
    const response = await fetch('https://api.llama.fi/overview/dexs', {
      next: { revalidate: 300 } // Cache for 5 minutes in Next.js
    });
    
    if (!response.ok) throw new Error('Failed to fetch volume');
    
    const data = await response.json();
    const totalVolume = data.totalVolume || 0;
    
    // Cache the result
    cachedVolume = { value: totalVolume, timestamp: Date.now() };
    
    return totalVolume;
  } catch (error) {
    console.error('Error fetching volume:', error);
    return cachedVolume?.value || 0;
  }
}

/**
 * Format large numbers for display
 */
export function formatVolume(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Get static stats (tokens and chains count)
 */
export function getStaticStats(): { tokensListed: number; supportedChains: number } {
  return {
    tokensListed: ALL_TOKENS.length,
    supportedChains: CHAINS.length
  };
}

/**
 * Get all swap stats including dynamic volume
 */
export async function getSwapStats(): Promise<SwapStats> {
  const { tokensListed, supportedChains } = getStaticStats();
  const totalVolumeRaw = await fetchTotalVolume();
  
  return {
    tokensListed,
    supportedChains,
    totalVolume: formatVolume(totalVolumeRaw),
    totalVolumeRaw
  };
}
