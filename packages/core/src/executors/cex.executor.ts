// packages/core/src/executors/cex.executor.ts

import crypto from 'crypto';
import {
  BaseExecutor,
  ExecutionContext,
  ExecutionResult,
  TransactionStatus,
} from './base.executor';
import { ethers } from 'ethers';

interface MEXCCredentials {
  apiKey: string;
  secretKey: string;
}

// Network mapping
const CHAIN_TO_NETWORK: Record<string, string> = {
  ethereum: 'ERC20',
  arbitrum: 'ARBITRUM',
  optimism: 'OPTIMISM',
  polygon: 'MATIC',
  bsc: 'BEP20',
  avalanche: 'AVAX_CCHAIN',
  base: 'BASE',
  solana: 'SOL',
  sui: 'SUI',
};

export class CEXExecutor extends BaseExecutor {
  readonly chainType = 'CEX' as const;
  readonly supportedChains = ['mexc'];

  private baseUrl = 'https://api.mexc.com';

  async prepareTransaction(context: ExecutionContext): Promise<{
    to: string;
    data: string;
    value: string;
  }> {
    const { step, cexCredentials } = context;

    if (!cexCredentials) {
      throw new Error('CEX credentials required');
    }

    // For CEX, we return deposit address as "to"
    if (step.type === 'CEX_DEPOSIT') {
      const network = CHAIN_TO_NETWORK[step.inputToken.chainId];
      const depositAddress = await this.getDepositAddress(
        cexCredentials,
        step.inputToken.symbol,
        network
      );

      return {
        to: depositAddress.address,
        data: depositAddress.tag || '',
        value: step.inputAmount,
      };
    }

    // For trades and withdrawals, no transaction needed from user
    return {
      to: '',
      data: '',
      value: '0',
    };
  }

  async executeTransaction(context: ExecutionContext): Promise<ExecutionResult> {
    const { step, cexCredentials } = context;

    if (!cexCredentials) {
      return {
        success: false,
        error: 'CEX credentials required',
      };
    }

    try {
      switch (step.type) {
        case 'CEX_DEPOSIT':
          // Deposit is handled by on-chain transfer
          // Just return success and wait for deposit confirmation
          return {
            success: true,
            pendingId: `deposit-${Date.now()}`,
            estimatedCompletionTime: 300, // 5 minutes
          };

        case 'CEX_TRADE':
          return await this.executeTrade(cexCredentials, step);

        case 'CEX_WITHDRAW':
          return await this.executeWithdraw(cexCredentials, step, context.userAddress);

        default:
          return {
            success: false,
            error: `Unknown step type: ${step.type}`,
          };
      }
    } catch (error: any) {
      console.error(`[CEX] Execution failed:`, error);
      return {
        success: false,
        error: error.message || 'CEX operation failed',
      };
    }
  }

  async getTransactionStatus(
    chainId: string,
    txHash: string
  ): Promise<TransactionStatus> {
    // For CEX, txHash is actually an operation ID
    // Status checking depends on operation type
    
    if (txHash.startsWith('deposit-')) {
      // Check deposit history
      return {
        status: 'PENDING',
      };
    }

    if (txHash.startsWith('order-')) {
      // Check order status
      return {
        status: 'CONFIRMED',
      };
    }

    if (txHash.startsWith('withdraw-')) {
      // Check withdrawal status
      return {
        status: 'PENDING',
      };
    }

    return {
      status: 'PENDING',
    };
  }

  async estimateGas(context: ExecutionContext): Promise<string> {
    // CEX doesn't use gas
    return '0';
  }

  async checkAllowance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    // CEX doesn't use allowances
    return BigInt(ethers.MaxUint256);
  }

  async buildApprovalTransaction(
    chainId: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<null> {
    return null;
  }

  // ============ MEXC API Methods ============

  private sign(queryString: string, secretKey: string): string {
    return crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');
  }

  private async fetchMEXC<T>(
    credentials: MEXCCredentials,
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    params: Record<string, string> = {}
  ): Promise<T> {
    const timestamp = Date.now();
    const queryParams = new URLSearchParams({
      ...params,
      timestamp: timestamp.toString(),
    });
    
    const signature = this.sign(queryParams.toString(), credentials.secretKey);
    queryParams.append('signature', signature);

    const url = `${this.baseUrl}${endpoint}?${queryParams}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'X-MEXC-APIKEY': credentials.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MEXC API error: ${error}`);
    }

    return response.json();
  }

  private async getDepositAddress(
    credentials: MEXCCredentials,
    coin: string,
    network: string
  ): Promise<{ address: string; tag?: string }> {
    return this.fetchMEXC(
      credentials,
      '/api/v3/capital/deposit/address',
      'GET',
      { coin, network }
    );
  }

  private async executeTrade(
    credentials: MEXCCredentials,
    step: any
  ): Promise<ExecutionResult> {
    const symbol = `${step.inputToken.symbol}${step.outputToken.symbol}`;
    
    // Place market order
    const order = await this.fetchMEXC<{
      orderId: string;
      executedQty: string;
      cummulativeQuoteQty: string;
      status: string;
    }>(
      credentials,
      '/api/v3/order',
      'POST',
      {
        symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: step.inputAmount,
      }
    );

    if (order.status === 'FILLED') {
      return {
        success: true,
        txHash: `order-${order.orderId}`,
        actualOutput: order.executedQty,
      };
    }

    return {
      success: false,
      error: `Order status: ${order.status}`,
    };
  }

  private async executeWithdraw(
    credentials: MEXCCredentials,
    step: any,
    toAddress: string
  ): Promise<ExecutionResult> {
    const network = CHAIN_TO_NETWORK[step.outputToken.chainId];
    
    const withdrawal = await this.fetchMEXC<{ id: string }>(
      credentials,
      '/api/v3/capital/withdraw',
      'POST',
      {
        coin: step.outputToken.symbol,
        network,
        address: toAddress,
        amount: step.inputAmount,
      }
    );

    return {
      success: true,
      txHash: `withdraw-${withdrawal.id}`,
      pendingId: withdrawal.id,
      estimatedCompletionTime: 600, // 10 minutes
    };
  }

  /**
   * Check deposit status
   */
  async checkDepositStatus(
    credentials: MEXCCredentials,
    coin: string,
    txHash: string
  ): Promise<{
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    amount?: string;
  }> {
    const deposits = await this.fetchMEXC<Array<{
      txId: string;
      status: number;
      amount: string;
    }>>(
      credentials,
      '/api/v3/capital/deposit/hisrec',
      'GET',
      { coin }
    );

    const deposit = deposits.find(d => d.txId === txHash);
    
    if (!deposit) {
      return { status: 'PENDING' };
    }

    // MEXC status: 0=pending, 1=success, 2=failed
    if (deposit.status === 1) {
      return { status: 'SUCCESS', amount: deposit.amount };
    }
    if (deposit.status === 2) {
      return { status: 'FAILED' };
    }

    return { status: 'PENDING' };
  }

  /**
   * Check withdrawal status
   */
  async checkWithdrawStatus(
    credentials: MEXCCredentials,
    withdrawId: string
  ): Promise<{
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    txHash?: string;
  }> {
    const withdrawals = await this.fetchMEXC<Array<{
      id: string;
      status: number;
      txId: string;
    }>>(
      credentials,
      '/api/v3/capital/withdraw/history',
      'GET',
      {}
    );

    const withdrawal = withdrawals.find(w => w.id === withdrawId);
    
    if (!withdrawal) {
      return { status: 'PENDING' };
    }

    // MEXC status: varies by exchange
    if (withdrawal.status === 6) {
      return { status: 'SUCCESS', txHash: withdrawal.txId };
    }
    if (withdrawal.status === 5) {
      return { status: 'FAILED' };
    }

    return { status: 'PENDING' };
  }

  /**
   * Get CEX balance
   */
  async getBalance(
    credentials: MEXCCredentials,
    asset: string
  ): Promise<{ free: string; locked: string }> {
    const account = await this.fetchMEXC<{
      balances: Array<{
        asset: string;
        free: string;
        locked: string;
      }>;
    }>(credentials, '/api/v3/account', 'GET');

    const balance = account.balances.find(b => b.asset === asset);
    
    return {
      free: balance?.free || '0',
      locked: balance?.locked || '0',
    };
  }
}
