// packages/core/src/executors/base.executor.ts

import { RouteStep } from '@omniswap/types';

export interface ExecutionContext {
  swap: {
    id: string;
    userAddress: string;
    route: { steps: RouteStep[] };
  };
  step: RouteStep;
  stepIndex: number;
  userAddress: string;

  // Signed transaction (from frontend)
  signedTransaction?: string;
  signature?: string;

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

  supportsChain(chainId: string): boolean {
    return this.supportedChains.includes(chainId);
  }

  abstract prepareTransaction(context: ExecutionContext): Promise<{
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    chainId?: number;
    serializedTransaction?: string;
  }>;

  abstract executeTransaction(context: ExecutionContext): Promise<ExecutionResult>;

  abstract getTransactionStatus(chainId: string, txHash: string): Promise<TransactionStatus>;

  abstract estimateGas(context: ExecutionContext): Promise<string>;

  abstract checkAllowance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint>;

  abstract buildApprovalTransaction(
    chainId: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<{ to: string; data: string; value: string } | null>;
}
