import { PrismaClient, Prisma, SwapStatus } from '@prisma/client';
import { Redis } from 'ioredis';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { QuoteService, Quote, SwapRoute } from './quote.service';
import { WalletService, EVMWalletService, SolanaWalletService, SuiWalletService } from './wallet.service';
import { OneInchAdapter } from '../adapters/oneinch.adapter';
import { JupiterAdapter } from '../adapters/jupiter.adapter';
import { CetusAdapter } from '../adapters/cetus.adapter';
import { LiFiAdapter } from '../adapters/lifi.adapter';

// ============================================================================
// Types
// ============================================================================

export interface ExecuteSwapRequest {
  userId: string;
  quoteId: string;
  routeIndex: number;
  userAddress?: string;
  signedTransaction?: string; // For pre-signed transactions
}

export interface SwapResult {
  swapId: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'failed';
  txHash: string;
  chainId: number;
  inputAmount: string;
  outputAmount: string;
  actualOutputAmount?: string;
  platformFee: string;
  gasFee?: string;
  blockNumber?: number;
  explorerUrl: string;
  error?: string;
}

export interface SwapTransaction {
  chainId: number;
  chainType: 'evm' | 'solana' | 'sui';
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface BuildSwapResult {
  transaction: SwapTransaction;
  approvalRequired: boolean;
  approvalTransaction?: SwapTransaction;
  estimatedGas: string;
  estimatedGasUsd: number;
}

// ============================================================================
// Swap Service
// ============================================================================

export class SwapService {
  private prisma: PrismaClient;
  private redis: Redis;
  private quoteService: QuoteService;
  private walletService: WalletService;
  private oneInchAdapter: OneInchAdapter;
  private jupiterAdapter: JupiterAdapter;
  private cetusAdapter: CetusAdapter;
  private lifiAdapter: LiFiAdapter;

  private readonly PLATFORM_FEE_BPS = 40; // 0.4%
  private readonly FEE_COLLECTOR_ADDRESS = process.env.FEE_COLLECTOR_ADDRESS || '';

  private readonly EXPLORER_URLS: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    43114: 'https://snowtrace.io/tx/',
    101: 'https://solscan.io/tx/',
    784: 'https://suiscan.xyz/tx/',
  };

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    quoteService: QuoteService,
    walletService: WalletService,
    oneInchAdapter: OneInchAdapter,
    jupiterAdapter: JupiterAdapter,
    cetusAdapter: CetusAdapter,
    lifiAdapter: LiFiAdapter
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.quoteService = quoteService;
    this.walletService = walletService;
    this.oneInchAdapter = oneInchAdapter;
    this.jupiterAdapter = jupiterAdapter;
    this.cetusAdapter = cetusAdapter;
    this.lifiAdapter = lifiAdapter;
  }

  // --------------------------------------------------------------------------
  // Build Swap Transaction
  // --------------------------------------------------------------------------

  async buildSwapTransaction(
    quoteId: string,
    routeIndex: number,
    userAddress: string
  ): Promise<BuildSwapResult> {
    const quote = await this.quoteService.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('Quote not found or expired');
    }

    const route = quote.routes[routeIndex];
    if (!route) {
      throw new Error('Invalid route index');
    }

    const chainType = this.walletService.getChainType(quote.inputChainId);
    let result: BuildSwapResult;

    switch (route.source) {
      case '1inch':
        result = await this.buildOneInchSwap(quote, route, userAddress);
        break;
      case 'Jupiter':
        result = await this.buildJupiterSwap(quote, route, userAddress);
        break;
      case 'Cetus':
        result = await this.buildCetusSwap(quote, route, userAddress);
        break;
      case 'Li.Fi':
        result = await this.buildLiFiSwap(quote, route, userAddress);
        break;
      default:
        throw new Error(`Unsupported route source: ${route.source}`);
    }

    return result;
  }

  private async buildOneInchSwap(
    quote: Quote,
    route: SwapRoute,
    userAddress: string
  ): Promise<BuildSwapResult> {
    // Check if approval is needed
    const evmService = this.walletService.getEVMService();
    const spenderAddress = await this.oneInchAdapter.getSpenderAddress(quote.inputChainId);
    
    if (!spenderAddress) {
      throw new Error('Failed to get 1inch spender address');
    }

    let approvalRequired = false;
    let approvalTransaction: SwapTransaction | undefined;

    // Check allowance (skip for native token)
    const isNativeToken = quote.inputTokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    
    if (!isNativeToken) {
      const allowance = await evmService.checkAllowance(
        quote.inputChainId,
        quote.inputTokenAddress,
        userAddress,
        spenderAddress
      );

      if (parseFloat(allowance) < parseFloat(quote.inputAmount)) {
        approvalRequired = true;
        const approvalData = await this.oneInchAdapter.getApproveCalldata(
          quote.inputChainId,
          quote.inputTokenAddress,
          ethers.MaxUint256.toString()
        );

        if (approvalData) {
          approvalTransaction = {
            chainId: quote.inputChainId,
            chainType: 'evm',
            to: approvalData.to,
            data: approvalData.data,
            value: approvalData.value,
          };
        }
      }
    }

    // Get swap transaction
    const swapData = await this.oneInchAdapter.getSwapData({
      chainId: quote.inputChainId,
      fromTokenAddress: quote.inputTokenAddress,
      toTokenAddress: quote.outputTokenAddress,
      amount: this.toWei(quote.inputAmount, 18), // Adjust decimals as needed
      slippage: quote.slippageBps / 100,
      fromAddress: userAddress,
    });

    if (!swapData?.tx) {
      throw new Error('Failed to get 1inch swap data');
    }

    return {
      transaction: {
        chainId: quote.inputChainId,
        chainType: 'evm',
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: swapData.tx.value,
        gasLimit: swapData.tx.gas,
        maxFeePerGas: swapData.tx.gasPrice,
      },
      approvalRequired,
      approvalTransaction,
      estimatedGas: swapData.tx.gas,
      estimatedGasUsd: route.estimatedGasUsd,
    };
  }

  private async buildJupiterSwap(
    quote: Quote,
    route: SwapRoute,
    userAddress: string
  ): Promise<BuildSwapResult> {
    const jupiterQuote = route.routeData;
    
    const swapResponse = await this.jupiterAdapter.getSwapTransaction({
      quoteResponse: jupiterQuote,
      userPublicKey: userAddress,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    });

    if (!swapResponse?.swapTransaction) {
      throw new Error('Failed to get Jupiter swap transaction');
    }

    return {
      transaction: {
        chainId: 101,
        chainType: 'solana',
        to: '', // Not applicable for Solana
        data: swapResponse.swapTransaction, // Base64 encoded transaction
        value: '0',
      },
      approvalRequired: false, // Solana doesn't need approvals
      estimatedGas: swapResponse.computeUnitLimit.toString(),
      estimatedGasUsd: route.estimatedGasUsd,
    };
  }

  private async buildCetusSwap(
    quote: Quote,
    route: SwapRoute,
    userAddress: string
  ): Promise<BuildSwapResult> {
    const cetusQuote = route.routeData;

    const txData = await this.cetusAdapter.buildSwapTransaction({
      quote: cetusQuote,
      senderAddress: userAddress,
      slippageBps: quote.slippageBps,
    });

    if (!txData) {
      throw new Error('Failed to build Cetus swap transaction');
    }

    return {
      transaction: {
        chainId: 784,
        chainType: 'sui',
        to: '', // Not applicable for Sui
        data: txData.txBytes, // Serialized transaction bytes
        value: '0',
      },
      approvalRequired: false,
      estimatedGas: txData.estimatedGas,
      estimatedGasUsd: route.estimatedGasUsd,
    };
  }

  private async buildLiFiSwap(
    quote: Quote,
    route: SwapRoute,
    userAddress: string
  ): Promise<BuildSwapResult> {
    const lifiRoute = route.routeData;
    
    // Get transaction data for the first step
    if (!lifiRoute.steps || lifiRoute.steps.length === 0) {
      throw new Error('Li.Fi route has no steps');
    }

    const step = lifiRoute.steps[0];
    step.action.fromAddress = userAddress;
    step.action.toAddress = userAddress;

    const stepWithTx = await this.lifiAdapter.getStepTransaction(step);
    
    if (!stepWithTx?.transactionRequest) {
      throw new Error('Failed to get Li.Fi step transaction');
    }

    const txRequest = stepWithTx.transactionRequest;

    // Check approval for EVM chains
    let approvalRequired = false;
    let approvalTransaction: SwapTransaction | undefined;

    if (step.estimate?.approvalAddress && quote.inputChainId !== 101 && quote.inputChainId !== 784) {
      const evmService = this.walletService.getEVMService();
      const allowance = await evmService.checkAllowance(
        quote.inputChainId,
        quote.inputTokenAddress,
        userAddress,
        step.estimate.approvalAddress
      );

      if (parseFloat(allowance) < parseFloat(quote.inputAmount)) {
        approvalRequired = true;
        const approvalTx = await evmService.buildApprovalTransaction({
          chainType: 'evm',
          chainId: quote.inputChainId,
          tokenAddress: quote.inputTokenAddress,
          spenderAddress: step.estimate.approvalAddress,
          amount: ethers.MaxUint256.toString(),
          ownerAddress: userAddress,
        });

        approvalTransaction = {
          chainId: quote.inputChainId,
          chainType: 'evm',
          to: approvalTx.to,
          data: approvalTx.data,
          value: '0',
          gasLimit: approvalTx.gasLimit,
        };
      }
    }

    return {
      transaction: {
        chainId: txRequest.chainId,
        chainType: 'evm',
        to: txRequest.to,
        data: txRequest.data,
        value: txRequest.value,
        gasLimit: txRequest.gasLimit,
      },
      approvalRequired,
      approvalTransaction,
      estimatedGas: txRequest.gasLimit,
      estimatedGasUsd: route.estimatedGasUsd,
    };
  }

  // --------------------------------------------------------------------------
  // Execute Swap
  // --------------------------------------------------------------------------

  async executeSwap(request: ExecuteSwapRequest): Promise<SwapResult> {
    const { userId, quoteId, routeIndex, userAddress, signedTransaction } = request;

    const quote = await this.quoteService.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('Quote not found or expired');
    }

    const route = quote.routes[routeIndex];
    if (!route) {
      throw new Error('Invalid route index');
    }

    // Create swap record
    const swap = await this.prisma.swap.create({
      data: {
        userId,
        quoteId,
        status: 'PENDING',
        inputChainId: quote.inputChainId,
        inputTokenAddress: quote.inputTokenAddress,
        inputTokenSymbol: quote.inputTokenSymbol,
        inputAmount: new Prisma.Decimal(quote.inputAmount),
        outputChainId: quote.outputChainId,
        outputTokenAddress: quote.outputTokenAddress,
        outputTokenSymbol: quote.outputTokenSymbol,
        expectedOutputAmount: new Prisma.Decimal(route.outputAmount),
        slippageBps: quote.slippageBps,
        platformFeeBps: this.PLATFORM_FEE_BPS,
        routeSource: route.source,
        routeData: route.routeData,
      },
    });

    logger.info('Swap initiated', {
      swapId: swap.id,
      userId,
      quoteId,
      source: route.source,
    });

    try {
      let txHash: string;
      const chainType = this.walletService.getChainType(quote.inputChainId);

      if (signedTransaction) {
        // User has pre-signed the transaction
        txHash = await this.broadcastTransaction(
          quote.inputChainId,
          chainType,
          signedTransaction
        );
      } else {
        throw new Error('Signed transaction required');
      }

      // Update swap with tx hash
      await this.prisma.swap.update({
        where: { id: swap.id },
        data: {
          status: 'CONFIRMING',
          txHash,
        },
      });

      // Start monitoring transaction
      this.monitorTransaction(swap.id, quote.inputChainId, txHash, chainType);

      return {
        swapId: swap.id,
        status: 'pending',
        txHash,
        chainId: quote.inputChainId,
        inputAmount: quote.inputAmount,
        outputAmount: route.outputAmount,
        platformFee: this.calculatePlatformFee(quote.inputAmount),
        explorerUrl: `${this.EXPLORER_URLS[quote.inputChainId]}${txHash}`,
      };
    } catch (error) {
      // Update swap as failed
      await this.prisma.swap.update({
        where: { id: swap.id },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error).message,
        },
      });

      throw error;
    }
  }

  private async broadcastTransaction(
    chainId: number,
    chainType: 'evm' | 'solana' | 'sui',
    signedTransaction: string
  ): Promise<string> {
    switch (chainType) {
      case 'evm': {
        const evmService = this.walletService.getEVMService();
        const result = await evmService.sendTransaction(chainId, signedTransaction);
        return result.txHash;
      }
      case 'solana': {
        const solanaService = this.walletService.getSolanaService();
        const { VersionedTransaction } = await import('@solana/web3.js');
        const txBuffer = Buffer.from(signedTransaction, 'base64');
        const tx = VersionedTransaction.deserialize(txBuffer);
        return await solanaService.sendTransaction(tx);
      }
      case 'sui': {
        const suiService = this.walletService.getSuiService();
        // For Sui, signedTransaction should be JSON with txBytes and signature
        const { txBytes, signature } = JSON.parse(signedTransaction);
        const result = await suiService.executeTransaction(
          Buffer.from(txBytes, 'base64'),
          signature
        );
        return result.digest;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Monitor Transaction
  // --------------------------------------------------------------------------

  private async monitorTransaction(
    swapId: string,
    chainId: number,
    txHash: string,
    chainType: 'evm' | 'solana' | 'sui'
  ): Promise<void> {
    const maxAttempts = 60; // 5 minutes with 5s intervals
    let attempts = 0;

    const checkStatus = async () => {
      attempts++;

      try {
        let confirmed = false;
        let success = false;
        let blockNumber: number | undefined;
        let gasUsed: string | undefined;

        switch (chainType) {
          case 'evm': {
            const evmService = this.walletService.getEVMService();
            const receipt = await evmService.waitForTransaction(chainId, txHash, 1);
            if (receipt) {
              confirmed = true;
              success = receipt.status === 1;
              blockNumber = receipt.blockNumber;
              gasUsed = receipt.gasUsed.toString();
            }
            break;
          }
          case 'solana': {
            const solanaService = this.walletService.getSolanaService();
            const result = await solanaService.waitForTransaction(txHash, 30000);
            confirmed = true;
            success = result.success;
            break;
          }
          case 'sui': {
            const suiService = this.walletService.getSuiService();
            const result = await suiService.waitForTransaction(txHash);
            confirmed = true;
            success = result.success;
            break;
          }
        }

        if (confirmed) {
          await this.prisma.swap.update({
            where: { id: swapId },
            data: {
              status: success ? 'CONFIRMED' : 'FAILED',
              blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
              gasUsed: gasUsed ? new Prisma.Decimal(gasUsed) : undefined,
              confirmedAt: new Date(),
              errorMessage: success ? undefined : 'Transaction reverted',
            },
          });

          logger.info('Swap completed', {
            swapId,
            txHash,
            success,
            blockNumber,
          });

          return;
        }
      } catch (error) {
        logger.error('Error checking transaction status', {
          swapId,
          txHash,
          error,
        });
      }

      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 5000);
      } else {
        // Timeout - mark as unknown
        await this.prisma.swap.update({
          where: { id: swapId },
          data: {
            status: 'FAILED',
            errorMessage: 'Transaction confirmation timeout',
          },
        });

        logger.warn('Swap confirmation timeout', { swapId, txHash });
      }
    };

    // Start checking
    setTimeout(checkStatus, 5000);
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  async getSwapStatus(swapId: string, userId: string): Promise<SwapResult | null> {
    const swap = await this.prisma.swap.findFirst({
      where: { id: swapId, userId },
    });

    if (!swap) return null;

    return {
      swapId: swap.id,
      status: this.mapSwapStatus(swap.status),
      txHash: swap.txHash || '',
      chainId: swap.inputChainId,
      inputAmount: swap.inputAmount.toString(),
      outputAmount: swap.expectedOutputAmount?.toString() || '0',
      actualOutputAmount: swap.actualOutputAmount?.toString(),
      platformFee: swap.platformFeeAmount?.toString() || '0',
      gasFee: swap.gasUsed?.toString(),
      blockNumber: swap.blockNumber ? Number(swap.blockNumber) : undefined,
      explorerUrl: swap.txHash
        ? `${this.EXPLORER_URLS[swap.inputChainId]}${swap.txHash}`
        : '',
      error: swap.errorMessage || undefined,
    };
  }

  async getSwapHistory(
    userId: string,
    filters?: {
      chainId?: number;
      status?: SwapStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ swaps: SwapResult[]; total: number }> {
    const where: Prisma.SwapWhereInput = { userId };

    if (filters?.chainId) {
      where.OR = [
        { inputChainId: filters.chainId },
        { outputChainId: filters.chainId },
      ];
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    const [swaps, total] = await Promise.all([
      this.prisma.swap.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.swap.count({ where }),
    ]);

    return {
      swaps: swaps.map((swap) => ({
        swapId: swap.id,
        status: this.mapSwapStatus(swap.status),
        txHash: swap.txHash || '',
        chainId: swap.inputChainId,
        inputAmount: swap.inputAmount.toString(),
        outputAmount: swap.expectedOutputAmount?.toString() || '0',
        actualOutputAmount: swap.actualOutputAmount?.toString(),
        platformFee: swap.platformFeeAmount?.toString() || '0',
        gasFee: swap.gasUsed?.toString(),
        blockNumber: swap.blockNumber ? Number(swap.blockNumber) : undefined,
        explorerUrl: swap.txHash
          ? `${this.EXPLORER_URLS[swap.inputChainId]}${swap.txHash}`
          : '',
      })),
      total,
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private calculatePlatformFee(inputAmount: string): string {
    const amount = parseFloat(inputAmount);
    const fee = (amount * this.PLATFORM_FEE_BPS) / 10000;
    return fee.toFixed(8);
  }

  private toWei(amount: string, decimals: number): string {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return whole + paddedFraction;
  }

  private mapSwapStatus(status: SwapStatus): 'pending' | 'confirming' | 'confirmed' | 'failed' {
    switch (status) {
      case 'PENDING':
        return 'pending';
      case 'CONFIRMING':
        return 'confirming';
      case 'CONFIRMED':
        return 'confirmed';
      case 'FAILED':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
