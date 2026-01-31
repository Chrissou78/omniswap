// RPC Configuration for all chains
export const RPC_ENDPOINTS = {
  // EVM Chains
  ethereum: process.env.NEXT_PUBLIC_ETH_RPC || 'https://eth.llamarpc.com',
  polygon: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
  arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
  optimism: process.env.NEXT_PUBLIC_OPTIMISM_RPC || 'https://mainnet.optimism.io',
  base: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
  bsc: process.env.NEXT_PUBLIC_BSC_RPC || 'https://bsc-dataseed.binance.org',
  avalanche: process.env.NEXT_PUBLIC_AVALANCHE_RPC || 'https://api.avax.network/ext/bc/C/rpc',
  
  // Solana
  solana: process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
  
  // Sui
  sui: process.env.NEXT_PUBLIC_SUI_RPC || 'https://fullnode.mainnet.sui.io',
};

// Chain IDs
export const CHAIN_IDS = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  bsc: 56,
  avalanche: 43114,
  solana: 101,
  sui: 784,
};