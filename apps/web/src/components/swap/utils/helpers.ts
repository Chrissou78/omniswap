import type { Token } from '../../../types';
import { CHAIN_SWAP_TIMES, LOCAL_STORAGE_KEY } from './constants';

export function isNativeToken(token: Token | null): boolean {
  if (!token) return false;
  return token.address === 'native' || 
         token.address === '0x' ||
         token.address === '0x0000000000000000000000000000000000000000' ||
         token.tags?.includes('native') ||
         false;
}

export function getDirectSwapTime(chainId: number): { seconds: number; display: string } {
  const config = CHAIN_SWAP_TIMES[chainId] || { blockTime: 12, confirmations: 2 };
  const seconds = config.blockTime * config.confirmations;
  
  if (seconds < 10) return { seconds, display: `~${seconds}s` };
  if (seconds < 60) return { seconds, display: `~${Math.round(seconds)}s` };
  return { seconds, display: `~${Math.round(seconds / 60)} min` };
}

export function getLocalSwapStats(): { count: number; volume: number; volume24h: number } {
  if (typeof window === 'undefined') return { count: 0, volume: 0, volume24h: 0 };
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return { count: 0, volume: 0, volume24h: 0 };
    const txs = JSON.parse(data);
    const completed = txs.filter((tx: any) => tx.status === 'completed');
    const volume = completed.reduce((sum: number, tx: any) => sum + (tx.fromAmountUsd || 0), 0);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const volume24h = completed
      .filter((tx: any) => tx.timestamp >= oneDayAgo)
      .reduce((sum: number, tx: any) => sum + (tx.fromAmountUsd || 0), 0);
    return { count: completed.length, volume, volume24h };
  } catch {
    return { count: 0, volume: 0, volume24h: 0 };
  }
}

export function getExtendedSwapStats() {
  if (typeof window === 'undefined') return { count: 0, volume: 0, volume24h: 0, volume7d: 0, volume30d: 0 };
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return { count: 0, volume: 0, volume24h: 0, volume7d: 0, volume30d: 0 };
    const txs = JSON.parse(data);
    const completed = txs.filter((tx: any) => tx.status === 'completed');
    const volume = completed.reduce((sum: number, tx: any) => sum + (tx.fromAmountUsd || 0), 0);
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    
    const volume24h = completed
      .filter((tx: any) => tx.timestamp >= oneDayAgo)
      .reduce((sum: number, tx: any) => sum + (tx.fromAmountUsd || 0), 0);
    const volume7d = completed
      .filter((tx: any) => tx.timestamp >= sevenDaysAgo)
      .reduce((sum: number, tx: any) => sum + (tx.fromAmountUsd || 0), 0);
    const volume30d = completed
      .filter((tx: any) => tx.timestamp >= thirtyDaysAgo)
      .reduce((sum: number, tx: any) => sum + (tx.fromAmountUsd || 0), 0);
      
    return { count: completed.length, volume, volume24h, volume7d, volume30d };
  } catch {
    return { count: 0, volume: 0, volume24h: 0, volume7d: 0, volume30d: 0 };
  }
}

export function recordSwapTransaction(tx: import('../types').SwapTransactionData): void {
  if (typeof window === 'undefined') return;
  try {
    const transaction = {
      ...tx,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now()
    };
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    const transactions = existing ? JSON.parse(existing) : [];
    transactions.unshift(transaction);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(transactions.slice(0, 1000)));
    window.dispatchEvent(new CustomEvent('omniswap_transaction'));
  } catch (error) {
    console.error('Failed to record transaction:', error);
  }
}
