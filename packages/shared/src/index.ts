// packages/shared/src/index.ts

// Export types
export * from './types';

// Export data
import chainsData from './data/chains.json';
import tokensData from './data/tokens.json';

import { Chain, Token, ConfigVersion } from './types';

export const CHAINS: Chain[] = chainsData.chains as Chain[];
export const TOKENS: Token[] = tokensData.tokens as Token[];

export const CONFIG_VERSION: ConfigVersion = {
  chains: '2026-01-24T00:00:00Z',
  tokens: '2026-01-24T00:00:00Z',
  version: '1.0.0',
};

// ============ Chain Helpers ============
export const getChainById = (chainId: number | string): Chain | undefined => {
  return CHAINS.find(
    (chain) => chain.id === chainId || chain.id.toString() === chainId.toString()
  );
};

export const getChainByName = (name: string): Chain | undefined => {
  return CHAINS.find((chain) => chain.name.toLowerCase() === name.toLowerCase());
};

export const getChainRpc = (chainId: number | string): string | null => {
  const chain = getChainById(chainId);
  return chain?.rpcDefault || null;
};

export const getEvmChains = (): Chain[] => {
  return CHAINS.filter((chain) => chain.type === 'evm');
};

export const getSolanaChain = (): Chain | undefined => {
  return CHAINS.find((chain) => chain.type === 'solana');
};

export const getSuiChain = (): Chain | undefined => {
  return CHAINS.find((chain) => chain.type === 'sui');
};

export const searchChains = (query: string): Chain[] => {
  const q = query.toLowerCase().trim();
  if (!q) return CHAINS;

  return CHAINS.filter(
    (chain) =>
      chain.name.toLowerCase().includes(q) ||
      chain.symbol.toLowerCase().includes(q) ||
      chain.id.toString().includes(q)
  );
};

export const getPopularChains = (limit: number = 10): Chain[] => {
  return [...CHAINS].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
};

// ============ Token Helpers ============
export const getTokensByChainId = (chainId: number | string): Token[] => {
  return TOKENS.filter(
    (token) =>
      token.chainId === chainId || token.chainId.toString() === chainId.toString()
  ).sort((a, b) => b.popularity - a.popularity);
};

export const getTokenByAddress = (
  chainId: number | string,
  address: string
): Token | undefined => {
  return TOKENS.find(
    (token) =>
      (token.chainId === chainId ||
        token.chainId.toString() === chainId.toString()) &&
      token.address.toLowerCase() === address.toLowerCase()
  );
};

export const getNativeToken = (chainId: number | string): Token | undefined => {
  return TOKENS.find(
    (token) =>
      (token.chainId === chainId ||
        token.chainId.toString() === chainId.toString()) &&
      token.address === 'native'
  );
};

export const getStablecoins = (chainId: number | string): Token[] => {
  return getTokensByChainId(chainId).filter((token) =>
    token.tags.includes('stablecoin')
  );
};

export const searchTokens = (chainId: number | string, query: string): Token[] => {
  const tokens = getTokensByChainId(chainId);
  const q = query.toLowerCase().trim();

  if (!q) return tokens;

  return tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
  );
};

// ============ Constants ============
export const DEFAULT_CHAIN_ID = 1;
export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_DEADLINE = 20;
export { useChains } from './hooks/useChains';
export { useTokens } from './hooks/useTokens';
export { useConfig } from './hooks/useConfig';

// ============ Config Service ============
export { ConfigService, createConfigService } from './configService';
export type { ConfigServiceOptions } from './configService';
