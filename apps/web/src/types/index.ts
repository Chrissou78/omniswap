// apps/web/src/types/index.ts

// Import and re-export all shared types
export * from '@omniswap/shared';

// Import for explicit reference
import type { Chain, Token } from '@omniswap/shared';

// Re-export for backward compatibility and IDE help
export type { Chain, Token };

// Re-export API/domain types used by lib/api.ts and stores
// (explicit exports here shadow the same-named, incompatible ApiResponse from @omniswap/shared)
export type {
  ApiResponse,
  Quote,
  QuoteRequest,
  QuoteResponse,
  Route,
  RouteStep,
  Swap,
} from '@omniswap/types';

// ============================================================================
// LOGO REGISTRY (matches config/logos.json)
// ============================================================================

export type LogoEntry = string;

export interface LogosRegistry {
  version: number;
  updatedAt: number;
  chains: Record<string, LogoEntry>;
  tokens: Record<string, LogoEntry>;
}

// ============================================================================
// WEB-SPECIFIC TYPES
// ============================================================================

// This must match what getTokenPrice returns
export interface TokenPrice {
  priceUsd: number;
  source: string;  // 'coingecko', 'dexscreener', etc.
  timestamp: number; // Date.now() when the price was fetched
}

export interface SwapWidgetState {
  inputToken: Token | null;
  outputToken: Token | null;
  inputAmount: string;
  outputAmount: string;
  inputPrice: TokenPrice | null;
  outputPrice: TokenPrice | null;
  loading: boolean;
  error: string | null;
}

export interface DexScreenerToken {
  chainId: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price?: string;
  marketCap?: number;
  volume24h?: number;
  priceUsd?: number;
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: DexScreenerToken;
  quoteToken: DexScreenerToken;
  priceNative?: string;
  priceUsd?: string;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: {
    m5?: number;
    h1?: number;
    h24?: number;
  };
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

export interface CustomToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: string;
  logoUrl?: string;
  isCustom: true;
  isVerified: false;
  priceUsd?: number;
}

export interface TokenBalances {
  [key: string]: {
    balance: string;
  };
}

export interface RouteOption {
  type: 'direct' | 'delegated' | 'alternate';
  label: string;
  description: string;
  estimatedTime: string;
  estimatedTimeSeconds: number;
  totalFeeUsd: number;
  netOutputUsd: number;
  steps: string[];
  recommended: boolean;
  platformFeeUsd?: number;
  gasSponsored?: boolean;
  gasSavedUsd?: number;
  serviceFeePercent?: number;
  savings?: number;
}
