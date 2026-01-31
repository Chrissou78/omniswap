// apps/web/src/lib/chain-config.ts
// Single source of truth - reads from chains.json

import chainsData from '@/config/chains.json';
import { defineChain, type Chain } from 'viem';

export interface ChainConfig {
  id: number | string;
  name: string;
  symbol: string;
  color: string;
  type: 'evm' | 'solana' | 'sui';
  rpcDefault: string;
  rpcEnvKey: string;
  explorerUrl: string;
  explorerName: string;
  wrappedNativeAddress?: string;
  trustwalletId?: string;
  dexscreenerId?: string;
  defillamaId?: string;
  popularity: number;
}

// Parse all chains from JSON
export const CHAINS_CONFIG: ChainConfig[] = chainsData.chains.map((chain: any) => ({
  id: chain.id,
  name: chain.name,
  symbol: chain.symbol,
  color: chain.color || '#888888',
  type: (chain.type?.toLowerCase() || 'evm') as 'evm' | 'solana' | 'sui',
  rpcDefault: chain.rpcDefault || '',
  rpcEnvKey: chain.rpcEnvKey || '',
  explorerUrl: chain.explorerUrl || '',
  explorerName: chain.explorerName || '',
  wrappedNativeAddress: chain.wrappedNativeAddress,
  trustwalletId: chain.trustwalletId,
  dexscreenerId: chain.dexscreenerId,
  defillamaId: chain.defillamaId,
  popularity: chain.popularity || 0,
}));

// Get RPC URL - checks env first, falls back to default
export function getChainRpc(chainId: number | string): string {
  const chain = CHAINS_CONFIG.find(c => String(c.id) === String(chainId));
  if (!chain) return '';
  
  if (chain.rpcEnvKey && typeof process !== 'undefined') {
    const envRpc = process.env[chain.rpcEnvKey];
    if (envRpc) return envRpc;
  }
  
  return chain.rpcDefault;
}

// Get only EVM chains from config
export function getEvmChains(): ChainConfig[] {
  return CHAINS_CONFIG.filter(c => c.type === 'evm' && typeof c.id === 'number');
}

// Get Solana chain config
export function getSolanaChain(): ChainConfig | undefined {
  return CHAINS_CONFIG.find(c => c.type === 'solana');
}

// Get Sui chain config
export function getSuiChain(): ChainConfig | undefined {
  return CHAINS_CONFIG.find(c => c.type === 'sui');
}

// Get Solana RPC URL
export function getSolanaRpc(): string {
  const solana = getSolanaChain();
  if (!solana) return 'https://api.mainnet-beta.solana.com';
  
  // Check env first
  if (solana.rpcEnvKey && typeof process !== 'undefined') {
    const envRpc = process.env[solana.rpcEnvKey];
    if (envRpc) return envRpc;
  }
  
  return solana.rpcDefault || 'https://api.mainnet-beta.solana.com';
}

// Get Sui RPC URL
export function getSuiRpc(): string {
  const sui = getSuiChain();
  if (!sui) return 'https://fullnode.mainnet.sui.io';
  
  // Check env first
  if (sui.rpcEnvKey && typeof process !== 'undefined') {
    const envRpc = process.env[sui.rpcEnvKey];
    if (envRpc) return envRpc;
  }
  
  return sui.rpcDefault || 'https://fullnode.mainnet.sui.io';
}

// Get chain by ID
export function getChainById(chainId: number | string): ChainConfig | undefined {
  return CHAINS_CONFIG.find(c => String(c.id) === String(chainId));
}

// EVM chain IDs for quick lookup
export const EVM_CHAIN_IDS: number[] = getEvmChains().map(c => c.id as number);

// Dynamically build viem Chain objects from chains.json
export function buildViemChains(): Chain[] {
  return getEvmChains().map(config => {
    const rpcUrl = getChainRpc(config.id);
    
    return defineChain({
      id: config.id as number,
      name: config.name,
      nativeCurrency: {
        name: config.name,
        symbol: config.symbol,
        decimals: config.symbol === 'TRX' ? 6 : 18,
      },
      rpcUrls: {
        default: { http: [rpcUrl] },
      },
      blockExplorers: config.explorerUrl ? {
        default: { 
          name: config.explorerName || 'Explorer', 
          url: config.explorerUrl 
        },
      } : undefined,
    });
  });
}

// Build transport map for wagmi
export function buildTransportMap(): Record<number, string> {
  const map: Record<number, string> = {};
  for (const chain of getEvmChains()) {
    map[chain.id as number] = getChainRpc(chain.id);
  }
  return map;
}
