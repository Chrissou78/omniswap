// packages/core/src/executors/base.executor.ts

import { Swap, SwapStepExecution, RouteStep, Token } from '@omniswap/types';

export interface ExecutionContext {
  swap: Swap;
  step: RouteStep;
  stepIndex: number;
  userAddress: string;
  
  // Signed transaction (from frontend)
  signedTransaction?: string;
  
  // For CEX
  cexCredentials?: {
    apiKey: string;
    secretKey: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  actualOutput?: string;
  error?: string;
  
  // For async operations (bridges, CEX)
  pendingId?: string;
  estimatedCompletionTime?: number;
}

export interface TransactionStatus {
  status: 'PENDING' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';
  confirmations?: number;
  requiredConfirmations?: number;
  blockNumber?: number;
  timestamp?: number;
  error?: string;
  
  // For bridges
  destinationTxHash?: string;
  destinationStatus?: 'PENDING' | 'COMPLETED';
}

export abstract class BaseExecutor {
  abstract readonly chainType: 'EVM' | 'SOLANA' | 'SUI' | 'CEX';
  abstract readonly supportedChains: string[];

  /**
   * Check if executor supports the given chain
   */
  supportsChain(chainId: string): boolean {
    return this.supportedChains.includes(chainId);
  }

  /**
   * Prepare transaction for signing
   * Returns unsigned transaction data
   */
  abstract prepareTransaction(
    context: ExecutionContext
  ): Promise<{
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    chainId?: number;
    
    // For non-EVM
    serializedTransaction?: string;
  }>;

  /**
   * Execute a signed transaction
   */
  abstract executeTransaction(
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  /**
   * Get transaction status
   */
  abstract getTransactionStatus(
    chainId: string,
    txHash: string
  ): Promise<TransactionStatus>;

  /**
   * Estimate gas for transaction
   */
  abstract estimateGas(
    context: ExecutionContext
  ): Promise<string>;

  /**
   * Check token approval (EVM only, others return true)
   */
  abstract checkAllowance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint>;

  /**
   * Build approval transaction (EVM only)
   */
  abstract buildApprovalTransaction(
    chainId: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<{
    to: string;
    data: string;
    value: string;
  } | null>;
}
