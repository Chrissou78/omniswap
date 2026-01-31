// apps/web/src/types/index.ts

export interface Chain {
  id: number | string;
  name: string;
  symbol: string;
  color: string;
  type: 'evm' | 'solana' | 'sui';
  trustwalletId?: string | null;
  dexscreenerId?: string;        // For DexScreener API
  defillamaId?: string;          // For DefiLlama API
  wrappedNativeAddress?: string; // WETH, WBNB, etc.
  rpcEnvKey: string;
  rpcDefault: string;
  explorerUrl: string;
  explorerName: string;
  popularity?: number;
}

export interface Token {
  chainId: number | string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  popularity?: number;
  isCustom?: boolean;
  coingeckoId?: string;  // For price lookups
}

export interface LogoEntry {
  url: string;
}

export interface LogosRegistry {
  version: number;
  updatedAt: number;
  chains: Record<string, string>;
  tokens: Record<string, string>;
}

export interface SwapTransaction {
  id: string;
  timestamp: number;
  fromChainId: number | string;
  toChainId: number | string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromAmountUsd: number;
  toAmountUsd: number;
  userAddress: string;
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface VolumeStats {
  total: number;
  last24h: number;
  last7d: number;
  last30d: number;
  transactionCount: number;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface QuoteRequest {
  fromChainId: number | string;
  toChainId: number | string;
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number;
  userAddress?: string;
}

export interface QuoteResponse {
  id: string;
  fromChainId: number | string;
  toChainId: number | string;
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  priceImpact: number;
  estimatedGas: string;
  route: RouteStep[];
  validUntil: number;
}

export interface RouteStep {
  chainId: number | string;
  protocol: string;
  action: 'swap' | 'bridge' | 'transfer';
  fromToken: string;
  toToken: string;
  estimatedGas?: string;
}

export interface Swap {
  id: string;
  quoteId: string;
  userAddress: string;
  fromChainId: number | string;
  toChainId: number | string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  txHash?: string;
  status: 'pending' | 'submitted' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
