// packages/core/src/executors/sui.executor.ts

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import {
  BaseExecutor,
  ExecutionContext,
  ExecutionResult,
  TransactionStatus,
} from './base.executor';
import { ethers } from 'ethers';

export class SuiExecutor extends BaseExecutor {
  readonly chainType = 'SUI' as const;
  readonly supportedChains = ['sui'];

  private client: SuiClient;

  constructor(rpcUrl?: string) {
    super();
    this.client = new SuiClient({
      url: rpcUrl || getFullnodeUrl('mainnet'),
    });
  }

  async prepareTransaction(context: ExecutionContext): Promise<{
    to: string;
    data: string;
    value: string;
    serializedTransaction?: string;
  }> {
    const { step } = context;

    // Cetus returns base64 encoded transaction bytes
    if (!step.txData) {
      throw new Error('Transaction data not available');
    }

    return {
      to: '',
      data: '',
      value: '0',
      serializedTransaction: step.txData,
    };
  }

  async executeTransaction(context: ExecutionContext): Promise<ExecutionResult> {
    const { signedTransaction } = context;

    if (!signedTransaction) {
      return {
        success: false,
        error: 'No signed transaction provided',
      };
    }

    try {
      // Execute the signed transaction
      const result = await this.client.executeTransactionBlock({
        transactionBlock: signedTransaction,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log(`[Sui] Transaction executed: ${result.digest}`);

      // Check if transaction was successful
      const status = result.effects?.status;
      
      if (status?.status === 'failure') {
        return {
          success: false,
          txHash: result.digest,
          error: status.error || 'Transaction failed',
        };
      }

      return {
        success: true,
        txHash: result.digest,
        blockNumber: Number(result.checkpoint),
      };
    } catch (error: any) {
      console.error(`[Sui] Transaction failed:`, error);
      return {
        success: false,
        error: error.message || 'Transaction failed',
      };
    }
  }

  async getTransactionStatus(
    chainId: string,
    txHash: string
  ): Promise<TransactionStatus> {
    try {
      const tx = await this.client.getTransactionBlock({
        digest: txHash,
        options: {
          showEffects: true,
        },
      });

      if (!tx) {
        return {
          status: 'PENDING',
        };
      }

      const status = tx.effects?.status;

      if (status?.status === 'failure') {
        return {
          status: 'FAILED',
          error: status.error,
          blockNumber: Number(tx.checkpoint),
        };
      }

      if (status?.status === 'success') {
        return {
          status: 'CONFIRMED',
          confirmations: 1,
          requiredConfirmations: 1,
          blockNumber: Number(tx.checkpoint),
        };
      }

      return {
        status: 'PENDING',
      };
    } catch (error: any) {
      return {
        status: 'PENDING',
        error: error.message,
      };
    }
  }

  async estimateGas(context: ExecutionContext): Promise<string> {
    // Sui uses gas budget
    // Return a reasonable default
    return '50000000'; // 0.05 SUI
  }

  async checkAllowance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    // Sui doesn't use allowances
    return BigInt(ethers.MaxUint256);
  }

  async buildApprovalTransaction(
    chainId: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<null> {
    // Sui doesn't need approvals
    return null;
  }

  /**
   * Get SUI balance
   */
  async getBalance(address: string): Promise<bigint> {
    const balance = await this.client.getBalance({
      owner: address,
    });
    return BigInt(balance.totalBalance);
  }

  /**
   * Get coin balance for a specific type
   */
  async getCoinBalance(address: string, coinType: string): Promise<bigint> {
    const balance = await this.client.getBalance({
      owner: address,
      coinType,
    });
    return BigInt(balance.totalBalance);
  }
}
