export const CHAIN_SWAP_TIMES: Record<number, { name: string; blockTime: number; confirmations: number }> = {
  1: { name: 'Ethereum', blockTime: 12, confirmations: 2 },
  56: { name: 'BSC', blockTime: 3, confirmations: 3 },
  137: { name: 'Polygon', blockTime: 2, confirmations: 3 },
  42161: { name: 'Arbitrum', blockTime: 0.25, confirmations: 1 },
  10: { name: 'Optimism', blockTime: 2, confirmations: 1 },
  8453: { name: 'Base', blockTime: 2, confirmations: 1 },
  43114: { name: 'Avalanche', blockTime: 2, confirmations: 3 },
  250: { name: 'Fantom', blockTime: 1, confirmations: 1 },
  324: { name: 'zkSync', blockTime: 1, confirmations: 1 },
  59144: { name: 'Linea', blockTime: 2, confirmations: 1 },
  534352: { name: 'Scroll', blockTime: 3, confirmations: 1 },
  5000: { name: 'Mantle', blockTime: 2, confirmations: 1 },
  146: { name: 'Sonic', blockTime: 1, confirmations: 1 },
};

export const ALTERNATE_ROUTE_TIME = {
  deposit: 60,
  trade: 5,
  withdraw: 300,
  total: { min: 300, max: 900 },
  display: '~5-15 min'
};

export const ROUTE_THRESHOLD_USD = 100;

export const MAX_TRANSACTIONS_STORED = 1000;

export const LOCAL_STORAGE_KEY = 'omniswap_transactions';

export const DELEGATED_ROUTE_TIME = {
  min: 30,
  max: 120,
  display: '~30s - 2min',
};

export const DELEGATED_SERVICE_FEE_PERCENT = 1;
export const DELEGATED_MIN_USD = 10;
export const DELEGATED_MAX_USD = 50000;

export const DELEGATED_SUPPORTED_CHAINS = [1, 56, 137, 42161, 10, 8453, 43114];
