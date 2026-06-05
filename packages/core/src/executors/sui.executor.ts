// packages/core/src/executors/sui.executor.ts

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import {
  BaseExecutor,
  ExecutionContext,
  ExecutionResult,
  TransactionStatus,
} from './base.executor';

export class SuiExecutor extends BaseExecutor {
  readonly chainType = 'SUI' as const;
  readonly supportedChains = ['sui', '784'];

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
    const { signedTransaction, signature } = context;

    if (!signedTransaction || !signature) {
      return {
        success: false,
        error: 'No signed transaction or signature provided',
      };
    }

    try {
      const result = await this.client.executeTransactionBlock({
        transactionBlock: signedTransaction,
        signature: signature,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log(`[Sui] Transaction executed: ${result.digest}`);

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

  async getTransactionStatus(chainId: string, txHash: string): Promise<TransactionStatus> {
    try {
      const tx = await this.client.getTransactionBlock({
        digest: txHash,
        options: { showEffects: true },
      });

      if (!tx) {
        return { status: 'PENDING' };
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

      return { status: 'PENDING' };
    } catch (error: any) {
      return { status: 'PENDING', error: error.message };
    }
  }

  async estimateGas(context: ExecutionContext): Promise<string> {
    return '50000000'; // 0.05 SUI
  }

  async checkAllowance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    // Sui doesn't use allowances
    return BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  }

  async buildApprovalTransaction(
    chainId: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<null> {
    return null;
  }

  async getBalance(address: string): Promise<bigint> {
    const balance = await this.client.getBalance({ owner: address });
    return BigInt(balance.totalBalance);
  }

  async getCoinBalance(address: string, coinType: string): Promise<bigint> {
    const balance = await this.client.getBalance({ owner: address, coinType });
    return BigInt(balance.totalBalance);
  }
}
