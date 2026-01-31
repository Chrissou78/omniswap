// packages/types/src/swaps.ts
import { Route, RouteStep } from './quotes';

export type SwapStatus = 
  | 'PENDING'
  | 'CONFIRMING'
  | 'PROCESSING'
  | 'BRIDGING'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export type StepStatus = 
  | 'PENDING'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'FAILED';

export interface SwapStepExecution extends RouteStep {
  status: StepStatus;
  txHash?: string;
  blockNumber?: number;
  confirmedAt?: Date;
  actualOutput?: string;
  error?: string;
}

export interface Swap {
  id: string;
  
  // User info
  userId?: string;
  userAddress: string;
  
  // Route info
  route: Route;
  steps: SwapStepExecution[];
  
  // Status
  status: SwapStatus;
  currentStepIndex: number;
  
  // Results
  inputAmount: string;
  expectedOutput: string;
  actualOutput?: string;
  
  // Fees
  platformFee: string;
  gasCost: string;
  
  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Error handling
  error?: string;
  refundTxHash?: string;
}

export interface SwapRequest {
  quoteId: string;
  routeId: string;
  userAddress: string;
  
  // Optional overrides
  slippage?: number;
  deadline?: number;
  
  // For CEX routes
  cexCredentials?: {
    apiKey: string;
    secretKey: string;
  };
}
