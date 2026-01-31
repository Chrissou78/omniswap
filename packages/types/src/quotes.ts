// packages/types/src/quotes.ts
import { Token } from './tokens';

export type RouteStepType = 'SWAP' | 'BRIDGE' | 'CEX_DEPOSIT' | 'CEX_TRADE' | 'CEX_WITHDRAW';

export interface RouteStep {
  type: RouteStepType;
  chainId: string;
  protocol: string;
  protocolLogo?: string;
  
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  expectedOutput: string;
  minimumOutput: string;
  
  // Estimates
  estimatedGas?: string;
  estimatedGasUsd?: number;
  estimatedTime: number;     // Seconds
  
  // Execution data
  txData?: string;
  txTo?: string;
  txValue?: string;
  
  // Additional info
  priceImpact?: number;
  slippage?: number;
}

export interface Route {
  id: string;
  steps: RouteStep[];
  
  // Summary
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  expectedOutput: string;
  minimumOutput: string;
  
  // Costs
  estimatedGasUsd: number;
  platformFee: string;
  platformFeeUsd: number;
  
  // Timing
  estimatedTime: number;
  
  // Quality metrics
  priceImpact: number;
  exchangeRate: number;
  confidence: number;        // 0-100
  
  // Tags
  tags: ('BEST_RETURN' | 'FASTEST' | 'CHEAPEST')[];
}

export interface QuoteRequest {
  inputToken: {
    chainId: string;
    address: string;
  };
  outputToken: {
    chainId: string;
    address: string;
  };
  inputAmount: string;
  slippage?: number;         // Default 0.5%
  userAddress?: string;
  
  // Preferences
  preferredRouteType?: 'BEST_RETURN' | 'FASTEST' | 'CHEAPEST';
  excludeProtocols?: string[];
  excludeBridges?: string[];
  enableCex?: boolean;
}

export interface QuoteResponse {
  id: string;
  timestamp: number;
  expiresAt: number;
  
  request: QuoteRequest;
  routes: Route[];
  
  // Best route summary
  bestRoute: Route;
  
  // Metadata
  processingTime: number;
  quotesReceived: number;
}
