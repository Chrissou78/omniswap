// apps/web/src/types/delegated.ts

export interface DelegatedSwapRequest {
  // User info
  userAddress: string;
  chainId: number;
  
  // Swap details
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  minOutputAmount: string;
  
  // Permit data (EIP-2612 or Permit2)
  permitType: 'eip2612' | 'permit2' | 'approval';
  permitSignature?: string;
  permitDeadline?: number;
  permitNonce?: number;
  
  // Meta info
  slippage: number;
  deadline: number;
  
  // Signature for the swap request
  signature: string;
  signatureDeadline: number;
}

export interface DelegatedSwapQuote {
  // Input/Output
  inputAmount: string;
  outputAmount: string;
  outputAmountAfterFee: string;
  
  // Fees
  serviceFeePercent: number;
  serviceFeeAmount: string;
  serviceFeeUsd: number;
  
  // Gas info (for transparency)
  estimatedGasUsd: number;
  platformCoversGas: boolean;
  
  // Route
  route: 'direct' | 'alternate' | 'delegated';
  routeDescription: string;
  
  // Timing
  estimatedTime: string;
  
  // Validity
  quoteId: string;
  expiresAt: number;
}

export interface DelegatedSwapResult {
  success: boolean;
  txHash?: string;
  inputAmount: string;
  outputAmount: string;
  serviceFee: string;
  error?: string;
}

export interface RelayerConfig {
  address: string;
  supportedChains: number[];
  minSwapUsd: number;
  maxSwapUsd: number;
  serviceFeePercent: number;
}
