// packages/core/src/executors/evm.executor.ts

import { ethers } from 'ethers';
import {
  BaseExecutor,
  ExecutionContext,
  ExecutionResult,
  TransactionStatus,
} from './base.executor';
import { SUPPORTED_CHAINS } from '@omniswap/types';

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

// Chain ID to RPC mapping
const CHAIN_RPC_URLS: Record<string, string[]> = {
  ethereum: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
  ],
  arbitrum: [
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
  ],
  optimism: [
    'https://mainnet.optimism.io',
    'https://rpc.ankr.com/optimism',
  ],
  polygon: [
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
  ],
  bsc: [
    'https://bsc-dataseed.binance.org',
    'https://rpc.ankr.com/bsc',
  ],
  base: [
    'https://mainnet.base.org',
    'https://base.publicnode.com',
  ],
  avalanche: [
    'https://api.avax.network/ext/bc/C/rpc',
    'https://rpc.ankr.com/avalanche',
  ],
};

export class EVMExecutor extends BaseExecutor {
  readonly chainType = 'EVM' as const;
  readonly supportedChains = Object.keys(CHAIN_RPC_URLS);

  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  /**
   * Get provider for chain with fallback
   */
  private getProvider(chainId: string): ethers.JsonRpcProvider {
    if (!this.providers.has(chainId)) {
      const rpcUrls = CHAIN_RPC_URLS[chainId];
      if (!rpcUrls || rpcUrls.length === 0) {
        throw new Error(`No RPC URL for chain ${chainId}`);
      }
      
      const provider = new ethers.JsonRpcProvider(rpcUrls[0]);
      this.providers.set(chainId, provider);
    }
    return this.providers.get(chainId)!;
  }

  /**
   * Get numeric chain ID
   */
  private getNumericChainId(chainId: string): number {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain || typeof chain.chainId !== 'number') {
      throw new Error(`Unknown chain: ${chainId}`);
    }
    return chain.chainId;
  }

  async prepareTransaction(context: ExecutionContext): Promise<{
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    chainId?: number;
  }> {
    const { step } = context;
    
    // The adapter should have provided tx data in the route step
    if (!step.txTo || !step.txData) {
      throw new Error('Transaction data not available in route step');
    }

    // Estimate gas
    const gasLimit = await this.estimateGas(context);

    return {
      to: step.txTo,
      data: step.txData,
      value: step.txValue || '0',
      gasLimit,
      chainId: this.getNumericChainId(step.chainId),
    };
  }

  async executeTransaction(context: ExecutionContext): Promise<ExecutionResult> {
    const { step, signedTransaction } = context;
    
    if (!signedTransaction) {
      return {
        success: false,
        error: 'No signed transaction provided',
      };
    }

    try {
      const provider = this.getProvider(step.chainId);
      
      // Broadcast signed transaction
      const txResponse = await provider.broadcastTransaction(signedTransaction);
      
      console.log(`[EVM] Transaction broadcasted: ${txResponse.hash}`);

      // Wait for first confirmation
      const receipt = await txResponse.wait(1);

      if (!receipt || receipt.status === 0) {
        return {
          success: false,
          txHash: txResponse.hash,
          error: 'Transaction reverted',
        };
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      console.error(`[EVM] Transaction failed:`, error);
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
      const provider = this.getProvider(chainId);
      const chain = SUPPORTED_CHAINS[chainId];
      const requiredConfirmations = chain?.confirmations || 12;

      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return {
          status: 'PENDING',
          requiredConfirmations,
        };
      }

      // Get current block for confirmation count
      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      if (receipt.status === 0) {
        return {
          status: 'FAILED',
          blockNumber: receipt.blockNumber,
          error: 'Transaction reverted',
        };
      }

      if (confirmations >= requiredConfirmations) {
        return {
          status: 'CONFIRMED',
          confirmations,
          requiredConfirmations,
          blockNumber: receipt.blockNumber,
        };
      }

      return {
        status: 'CONFIRMING',
        confirmations,
        requiredConfirmations,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      return {
        status: 'PENDING',
        error: error.message,
      };
    }
  }

  async estimateGas(context: ExecutionContext): Promise<string> {
    const { step, userAddress } = context;
    
    try {
      const provider = this.getProvider(step.chainId);
      
      const gasEstimate = await provider.estimateGas({
        from: userAddress,
        to: step.txTo,
        data: step.txData,
        value: step.txValue || '0',
      });

      // Add 20% buffer
      const bufferedGas = (gasEstimate * BigInt(120)) / BigInt(100);
      return bufferedGas.toString();
    } catch (error) {
      // Return default gas limit
      return '500000';
    }
  }

  async checkAllowance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    // Native token doesn't need approval
    if (
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      tokenAddress === ethers.ZeroAddress
    ) {
      return BigInt(ethers.MaxUint256);
    }

    try {
      const provider = this.getProvider(chainId);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      const allowance = await contract.allowance(ownerAddress, spenderAddress);
      return BigInt(allowance.toString());
    } catch (error) {
      console.error(`[EVM] Failed to check allowance:`, error);
      return BigInt(0);
    }
  }

  async buildApprovalTransaction(
    chainId: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<{ to: string; data: string; value: string } | null> {
    // Native token doesn't need approval
    if (
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      tokenAddress === ethers.ZeroAddress
    ) {
      return null;
    }

    const iface = new ethers.Interface(ERC20_ABI);
    const data = iface.encodeFunctionData('approve', [
      spenderAddress,
      amount === 'unlimited' ? ethers.MaxUint256 : amount,
    ]);

    return {
      to: tokenAddress,
      data,
      value: '0',
    };
  }

  /**
   * Get token balance
   */
  async getTokenBalance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string
  ): Promise<bigint> {
    const provider = this.getProvider(chainId);

    // Native token
    if (
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      tokenAddress === ethers.ZeroAddress
    ) {
      const balance = await provider.getBalance(ownerAddress);
      return BigInt(balance.toString());
    }

    // ERC20 token
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(ownerAddress);
    return BigInt(balance.toString());
  }
}
