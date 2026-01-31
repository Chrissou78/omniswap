// packages/types/src/chains.ts
export type ChainType = 'EVM' | 'SOLANA' | 'SUI' | 'CEX';

export interface Chain {
  id: string;                    // Unique identifier
  chainId: number | string;      // Native chain ID (1 for ETH, 'solana', 'sui')
  name: string;
  type: ChainType;
  nativeToken: {
    symbol: string;
    decimals: number;
    address: string;             // Native token address or identifier
  };
  rpcUrls: string[];
  explorerUrl: string;
  iconUrl: string;
  isTestnet: boolean;
  isActive: boolean;
  avgBlockTime: number;          // In seconds
  confirmations: number;         // Required confirmations
}

export const SUPPORTED_CHAINS: Record<string, Chain> = {
  // EVM Chains
  ethereum: {
    id: 'ethereum',
    chainId: 1,
    name: 'Ethereum',
    type: 'EVM',
    nativeToken: { symbol: 'ETH', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
    rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    explorerUrl: 'https://etherscan.io',
    iconUrl: '/chains/ethereum.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 12,
    confirmations: 12,
  },
  arbitrum: {
    id: 'arbitrum',
    chainId: 42161,
    name: 'Arbitrum One',
    type: 'EVM',
    nativeToken: { symbol: 'ETH', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    explorerUrl: 'https://arbiscan.io',
    iconUrl: '/chains/arbitrum.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 0.25,
    confirmations: 1,
  },
  optimism: {
    id: 'optimism',
    chainId: 10,
    name: 'Optimism',
    type: 'EVM',
    nativeToken: { symbol: 'ETH', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
    rpcUrls: ['https://mainnet.optimism.io'],
    explorerUrl: 'https://optimistic.etherscan.io',
    iconUrl: '/chains/optimism.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 2,
    confirmations: 1,
  },
  polygon: {
    id: 'polygon',
    chainId: 137,
    name: 'Polygon',
    type: 'EVM',
    nativeToken: { symbol: 'MATIC', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
    rpcUrls: ['https://polygon-rpc.com'],
    explorerUrl: 'https://polygonscan.com',
    iconUrl: '/chains/polygon.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 2,
    confirmations: 128,
  },
  bsc: {
    id: 'bsc',
    chainId: 56,
    name: 'BNB Chain',
    type: 'EVM',
    nativeToken: { symbol: 'BNB', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    explorerUrl: 'https://bscscan.com',
    iconUrl: '/chains/bsc.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 3,
    confirmations: 15,
  },
  base: {
    id: 'base',
    chainId: 8453,
    name: 'Base',
    type: 'EVM',
    nativeToken: { symbol: 'ETH', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
    rpcUrls: ['https://mainnet.base.org'],
    explorerUrl: 'https://basescan.org',
    iconUrl: '/chains/base.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 2,
    confirmations: 1,
  },
  avalanche: {
    id: 'avalanche',
    chainId: 43114,
    name: 'Avalanche',
    type: 'EVM',
    nativeToken: { symbol: 'AVAX', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    explorerUrl: 'https://snowtrace.io',
    iconUrl: '/chains/avalanche.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 2,
    confirmations: 1,
  },
  
  // Non-EVM Chains
  solana: {
    id: 'solana',
    chainId: 'solana',
    name: 'Solana',
    type: 'SOLANA',
    nativeToken: { symbol: 'SOL', decimals: 9, address: 'So11111111111111111111111111111111111111112' },
    rpcUrls: ['https://api.mainnet-beta.solana.com'],
    explorerUrl: 'https://solscan.io',
    iconUrl: '/chains/solana.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 0.4,
    confirmations: 32,
  },
  sui: {
    id: 'sui',
    chainId: 'sui',
    name: 'Sui',
    type: 'SUI',
    nativeToken: { symbol: 'SUI', decimals: 9, address: '0x2::sui::SUI' },
    rpcUrls: ['https://fullnode.mainnet.sui.io'],
    explorerUrl: 'https://suiscan.xyz',
    iconUrl: '/chains/sui.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 0.5,
    confirmations: 1,
  },
  
  // CEX
  mexc: {
    id: 'mexc',
    chainId: 'cex:mexc',
    name: 'MEXC',
    type: 'CEX',
    nativeToken: { symbol: 'USDT', decimals: 8, address: 'USDT' },
    rpcUrls: ['https://api.mexc.com'],
    explorerUrl: 'https://www.mexc.com',
    iconUrl: '/chains/mexc.svg',
    isTestnet: false,
    isActive: true,
    avgBlockTime: 0,
    confirmations: 0,
  },
};
