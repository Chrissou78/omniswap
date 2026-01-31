// apps/web/src/config/index.ts

import chainsJson from './chains.json';
import tokensJson from './tokens.json';
import logosJson from './logos.json';
import type { Chain, Token, LogosRegistry } from '../types';

// ============================================================================
// DATA LOADING & SORTING
// ============================================================================

export const CHAINS: Chain[] = (chainsJson.chains as Chain[])
  .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

export const ALL_TOKENS: Token[] = (tokensJson.tokens as Token[])
  .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

export const LOGOS: LogosRegistry = logosJson as LogosRegistry;

// ============================================================================
// CHAIN HELPERS
// ============================================================================

export function getChainById(id: string | number): Chain | undefined {
  return CHAINS.find(chain => chain.id === id || chain.id.toString() === id.toString());
}

export function getChainsByType(type: 'evm' | 'solana' | 'sui'): Chain[] {
  return CHAINS.filter(chain => chain.type === type);
}

export function searchChains(query: string): Chain[] {
  const q = query.toLowerCase();
  return CHAINS.filter(chain => 
    chain.name.toLowerCase().includes(q) || 
    chain.symbol.toLowerCase().includes(q)
  );
}

/**
 * Find chain by name or symbol (case-insensitive)
 */
export function findChainByNameOrSymbol(nameOrSymbol: string): Chain | undefined {
  const q = nameOrSymbol.toLowerCase().trim();
  return CHAINS.find(chain => 
    chain.name.toLowerCase() === q || 
    chain.symbol.toLowerCase() === q
  );
}

/**
 * Get TrustWallet ID for a chain - derived from chains.json data
 */
export function getTrustWalletIdForChain(chainId: string | number): string | undefined {
  const chain = getChainById(chainId);
  return chain?.trustwalletId;
}

/**
 * Find TrustWallet ID by name or symbol - searches chains.json
 */
export function findTrustWalletId(nameOrSymbol: string): string | undefined {
  const chain = findChainByNameOrSymbol(nameOrSymbol);
  return chain?.trustwalletId;
}

// ============================================================================
// TOKEN HELPERS
// ============================================================================

export interface TokenWithBalance extends Token {
  balance?: string;
  balanceUsd?: number;
}

export function getTokensByChainId(chainId: string | number): Token[] {
  return ALL_TOKENS
    .filter(t => t.chainId === chainId || t.chainId.toString() === chainId.toString())
    .sort((a, b) => {
      const aIsNative = a.tags?.includes('native') || a.address === 'native';
      const bIsNative = b.tags?.includes('native') || b.address === 'native';
      if (aIsNative && !bIsNative) return -1;
      if (!aIsNative && bIsNative) return 1;
      return (b.popularity || 0) - (a.popularity || 0);
    });
}

/**
 * Sort tokens by balance (descending), then by popularity
 * Tokens with balance come first, sorted by USD value or raw balance
 */
export function sortTokensByBalance(
  tokens: Token[], 
  balances: Record<string, { balance: string; balanceUsd?: number }>
): TokenWithBalance[] {
  return tokens
    .map(token => ({
      ...token,
      balance: balances[token.address.toLowerCase()]?.balance || '0',
      balanceUsd: balances[token.address.toLowerCase()]?.balanceUsd || 0
    }))
    .sort((a, b) => {
      // Native tokens always first
      const aIsNative = a.tags?.includes('native') || a.address === 'native';
      const bIsNative = b.tags?.includes('native') || b.address === 'native';
      if (aIsNative && !bIsNative) return -1;
      if (!aIsNative && bIsNative) return 1;

      // Then by USD balance (if available)
      const aBalanceUsd = a.balanceUsd || 0;
      const bBalanceUsd = b.balanceUsd || 0;
      if (aBalanceUsd !== bBalanceUsd) {
        return bBalanceUsd - aBalanceUsd;
      }

      // Then by raw balance
      const aBalance = parseFloat(a.balance || '0');
      const bBalance = parseFloat(b.balance || '0');
      if (aBalance !== bBalance) {
        return bBalance - aBalance;
      }

      // Finally by popularity
      return (b.popularity || 0) - (a.popularity || 0);
    });
}

export function getTokenByAddress(chainId: string | number, address: string): Token | undefined {
  return ALL_TOKENS.find(t => 
    (t.chainId === chainId || t.chainId.toString() === chainId.toString()) &&
    t.address.toLowerCase() === address.toLowerCase()
  );
}

export function getNativeToken(chainId: string | number): Token | undefined {
  return ALL_TOKENS.find(t => 
    (t.chainId === chainId || t.chainId.toString() === chainId.toString()) &&
    (t.tags?.includes('native') || t.address === 'native')
  );
}

export function searchTokens(chainId: string | number, query: string): Token[] {
  const q = query.toLowerCase();
  return getTokensByChainId(chainId).filter(t => 
    t.symbol.toLowerCase().includes(q) || 
    t.name.toLowerCase().includes(q) ||
    t.address.toLowerCase().includes(q)
  );
}

/**
 * Search tokens with balance sorting
 */
export function searchTokensWithBalances(
  chainId: string | number, 
  query: string,
  balances: Record<string, { balance: string; balanceUsd?: number }>
): TokenWithBalance[] {
  const filtered = searchTokens(chainId, query);
  return sortTokensByBalance(filtered, balances);
}

export function getTokensByTag(chainId: string | number, tag: string): Token[] {
  return getTokensByChainId(chainId).filter(t => t.tags?.includes(tag));
}

export function getStablecoins(chainId: string | number): Token[] {
  return getTokensByTag(chainId, 'stablecoin');
}

// ============================================================================
// LOGO HELPERS
// ============================================================================

const TRUSTWALLET_BASE = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

export function getChainLogo(chainId: string | number): string {
  const chainKey = chainId.toString();
  
  // Priority 1: Explicit logo in logos.json
  if (LOGOS.chains[chainKey]) {
    return LOGOS.chains[chainKey];
  }
  
  const chain = getChainById(chainId);
  
  // Priority 2: TrustWallet ID from chain config (chains.json)
  if (chain?.trustwalletId) {
    return `${TRUSTWALLET_BASE}/${chain.trustwalletId}/info/logo.png`;
  }
  
  // Priority 3: Fallback to coin-logos CDN by symbol
  if (chain?.symbol) {
    return `https://cdn.jsdelivr.net/gh/AugurWorks/coin-logos@master/coins/${chain.symbol.toLowerCase()}.png`;
  }
  
  return '/images/chains/unknown.png';
}

export function getTokenLogo(token: Token): string {
  const tokenKey = `${token.chainId}:${token.address.toLowerCase()}`;
  
  // Priority 1: Explicit logo in logos.json
  if (LOGOS.tokens[tokenKey]) {
    return LOGOS.tokens[tokenKey];
  }
  
  // Priority 2: logoURI from token data
  if (token.logoURI) {
    return token.logoURI;
  }
  
  const chain = getChainById(token.chainId);
  
  // Priority 3: TrustWallet token asset (for non-native tokens)
  if (chain?.trustwalletId && token.address && token.address !== 'native') {
    return `${TRUSTWALLET_BASE}/${chain.trustwalletId}/assets/${token.address}/logo.png`;
  }
  
  // Priority 4: Native token uses chain logo
  if (token.address === 'native' || token.tags?.includes('native')) {
    return getChainLogo(token.chainId);
  }
  
  return '/images/tokens/unknown.png';
}

// ============================================================================
// RE-EXPORT TYPES
// ============================================================================

export type { Chain, Token, LogosRegistry, LogoEntry } from '../types';
