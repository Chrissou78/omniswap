// apps/web/src/lib/wagmi.ts
// Fully dynamic - all chains loaded from chains.json

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import type { Chain } from 'viem';
import { buildViemChains, buildTransportMap, getEvmChains } from './chain-config';

// ============================================
// Dynamic Chain Loading from chains.json
// ============================================

// Build all chains dynamically from chains.json
const dynamicChains = buildViemChains();

// Ensure we have at least one chain (required by wagmi)
if (dynamicChains.length === 0) {
  throw new Error('No EVM chains found in chains.json');
}

// Cast to the required tuple type [Chain, ...Chain[]]
const chains = dynamicChains as [Chain, ...Chain[]];

// Build transports dynamically from chains.json RPCs
const rpcMap = buildTransportMap();
const transports: Record<number, ReturnType<typeof http>> = {};

for (const chainId of Object.keys(rpcMap)) {
  const id = parseInt(chainId, 10);
  const rpcUrl = rpcMap[id];
  transports[id] = rpcUrl ? http(rpcUrl) : http();
}

// ============================================
// Configuration
// ============================================

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

if (!projectId || projectId === 'demo-project-id-replace-me') {
  console.warn('WalletConnect projectId not found. Get one at https://cloud.reown.com/');
}

export const wagmiConfig = getDefaultConfig({
  appName: 'OmniSwap',
  projectId: projectId || 'demo',
  chains,
  ssr: true,
  transports,
});

// Export for use elsewhere
export { chains };

// Re-export chain utilities
export { getEvmChains, getChainById, getChainRpc, EVM_CHAIN_IDS } from './chain-config';
