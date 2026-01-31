import type { Chain, Token } from '../../types';

// apps/web/src/components/swap/types.ts

export interface RouteOption {
  type: 'direct' | 'alternate' | 'delegated';
  label: string;
  description: string;
  estimatedTime: string;
  estimatedTimeSeconds: number;
  totalFeeUsd: number;
  netOutputUsd: number;
  steps: string[];
  savings?: number;
  recommended?: boolean;
  // Delegated-specific fields
  serviceFeePercent?: number;
  serviceFeeUsd?: number;
  gasSponsored?: boolean;
  gasSavedUsd?: number;
  platformFeeUsd?: number;
}

export interface TokenBalances {
  [address: string]: {
    balance: string;
    usdValue?: number;
  };
}

export interface SwapTransactionData {
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
  route: 'direct' | 'delegated' | 'alternate';
  platformFeeUsd?: number;
  timestamp?: number;
}

export interface SwapStats {
  tokensListed: number;
  supportedChains: number;
  totalSwaps: number;
  totalVolume: string;
  volume24h: string;
  volume7d: string;
  volume30d: string;
  isLoading: boolean;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  isCustom?: boolean;
  customPrice?: number;
}

export interface ChainInfo {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  logoURI?: string;
  color?: string;
}

export interface SwapRoute {
  source: string;
  inputAmount: string;
  outputAmount: string;
  path: string[];
  estimatedGas?: string;
  priceImpact?: number;
  tx?: {
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
  };
}

export interface QuoteResponse {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  routes: SwapRoute[];
  selectedRoute?: SwapRoute;
  estimatedGas?: string;
  priceImpact?: number;
}

export interface SwapState {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  inputAmount: string;
  outputAmount: string;
  slippage: number;
  deadline: number;
  isLoading: boolean;
  error: string | null;
}
