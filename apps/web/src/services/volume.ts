// apps/web/src/services/volume.ts
import type { SwapTransaction, VolumeStats } from '../types';

const STORAGE_KEY = 'omniswap_transactions';
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get transactions from localStorage (client-side fallback)
 */
function getLocalTransactions(): SwapTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save transaction to localStorage
 */
function saveLocalTransaction(tx: SwapTransaction): void {
  if (typeof window === 'undefined') return;
  try {
    const transactions = getLocalTransactions();
    transactions.unshift(tx);
    // Keep last 1000 transactions locally
    const trimmed = transactions.slice(0, 1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save transaction:', error);
  }
}

/**
 * Record a new swap transaction
 */
export async function recordSwapTransaction(tx: Omit<SwapTransaction, 'id' | 'timestamp'>): Promise<SwapTransaction> {
  const transaction: SwapTransaction = {
    ...tx,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now()
  };

  // Save locally first (immediate feedback)
  saveLocalTransaction(transaction);

  // Send to backend API if available
  if (API_ENDPOINT) {
    try {
      await fetch(`${API_ENDPOINT}/api/swaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      });
    } catch (error) {
      console.error('Failed to record swap to API:', error);
    }
  }

  return transaction;
}

/**
 * Calculate volume stats from transactions
 */
function calculateVolumeStats(transactions: SwapTransaction[]): VolumeStats {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const completedTxs = transactions.filter(tx => tx.status === 'completed');

  let total = 0;
  let last24h = 0;
  let last7d = 0;
  let last30d = 0;

  for (const tx of completedTxs) {
    const volume = tx.fromAmountUsd || 0;
    total += volume;

    if (tx.timestamp >= oneDayAgo) {
      last24h += volume;
    }
    if (tx.timestamp >= sevenDaysAgo) {
      last7d += volume;
    }
    if (tx.timestamp >= thirtyDaysAgo) {
      last30d += volume;
    }
  }

  return {
    total,
    last24h,
    last7d,
    last30d,
    transactionCount: completedTxs.length
  };
}

/**
 * Fetch volume stats - tries API first, falls back to local
 */
export async function fetchOmniSwapVolume(): Promise<VolumeStats> {
  // Try API first
  if (API_ENDPOINT) {
    try {
      const response = await fetch(`${API_ENDPOINT}/api/stats/volume`, {
        next: { revalidate: 60 } // Cache for 1 minute
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch volume from API:', error);
    }
  }

  // Fallback to local storage
  const transactions = getLocalTransactions();
  return calculateVolumeStats(transactions);
}

/**
 * Format volume for display
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
  if (value === 0) {
    return '$0';
  }
  return `$${value.toFixed(2)}`;
}

export type { SwapTransaction, VolumeStats } from '../types';
