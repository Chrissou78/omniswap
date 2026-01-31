// packages/core/src/adapters/bridge/socket.adapter.ts
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';
import axios, { AxiosInstance } from 'axios';

export interface SocketConfig extends AdapterConfig {
  apiKey?: string;
}

export class SocketAdapter extends BaseAdapter {
  readonly name = 'socket';
  readonly type = 'BRIDGE' as const;
  readonly supportedChains = ['1', '56', '137', '42161', '10', '8453', '43114', '250', '324', '59144', '534352', '5000', '81457'];
  
  private readonly client: AxiosInstance;

  constructor(config: SocketConfig = {}) {
    super(config);
    
    this.client = axios.create({
      baseURL: 'https://api.socket.tech/v2',
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'API-KEY': config.apiKey }),
      },
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    // Socket handles cross-chain swaps between supported EVM chains
    const fromSupported = this.supportsChain(params.fromChainId);
    const toSupported = this.supportsChain(params.toChainId);
    const isCrossChain = params.fromChainId !== params.toChainId;
    
    return fromSupported && toSupported && isCrossChain;
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const queryParams: any = {
        fromChainId: parseInt(params.fromChainId),
        toChainId: parseInt(params.toChainId),
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        fromAmount: params.amount,
        userAddress: params.userAddress || '0x0000000000000000000000000000000000000000',
        uniqueRoutesPerBridge: true,
        sort: 'output',
        singleTxOnly: false,
      };

      if (params.slippage) {
        queryParams.defaultSwapSlippage = params.slippage * 100;
        queryParams.defaultBridgeSlippage = params.slippage * 100;
      }

      const response = await this.client.get('/quote', { params: queryParams });

      if (!response.data?.success || !response.data?.result?.routes?.length) {
        return null;
      }

      const bestRoute = response.data.result.routes[0];
      
      // Calculate estimated time from steps
      let estimatedTime = 0;
      const steps = bestRoute.userTxs?.flatMap((tx: any) => 
        tx.steps?.map((step: any) => ({
          type: step.type === 'bridge' ? 'bridge' : 'swap',
          protocol: step.protocol?.displayName || step.protocol?.name || 'Socket',
          fromToken: step.fromAsset?.symbol,
          toToken: step.toAsset?.symbol,
          fromChainId: step.fromChainId?.toString(),
          toChainId: step.toChainId?.toString(),
        })) || []
      ) || [];

      estimatedTime = bestRoute.serviceTime || bestRoute.maxServiceTime || 300;

      return {
        outputAmount: bestRoute.toAmount,
        outputAmountMin: bestRoute.toAmount, // Socket doesn't provide min directly
        estimatedGas: bestRoute.totalGasFeesInUsd?.toString() || '0',
        priceImpact: 0, // Socket doesn't provide price impact
        route: {
          steps,
          estimatedTimeSeconds: estimatedTime,
        },
        metadata: {
          routeId: bestRoute.routeId,
          usedBridges: bestRoute.usedBridgeNames,
          totalUserTx: bestRoute.totalUserTx,
          serviceTime: bestRoute.serviceTime,
          rawRoute: bestRoute,
        },
      };
    } catch (error: any) {
      console.error('[Socket] Quote error:', error.message);
      return null;
    }
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    try {
      const route = quote.metadata?.rawRoute;
      if (!route) {
        throw new Error('No route data in quote');
      }

      const response = await this.client.post('/build-tx', { route });

      if (!response.data?.success || !response.data?.result) {
        throw new Error('Failed to build transaction');
      }

      const txData = response.data.result;

      return {
        to: txData.txTarget,
        data: txData.txData,
        value: txData.value || '0',
        gasLimit: txData.gasLimit,
      };
    } catch (error: any) {
      console.error('[Socket] Build transaction error:', error.message);
      throw error;
    }
  }

  async getStatus(
    txHash: string,
    fromChainId: string,
    toChainId: string
  ): Promise<{ status: string; destinationTxHash?: string } | null> {
    try {
      const response = await this.client.get('/bridge-status', {
        params: {
          transactionHash: txHash,
          fromChainId: parseInt(fromChainId),
          toChainId: parseInt(toChainId),
        },
      });

      if (!response.data?.success) {
        return null;
      }

      return {
        status: response.data.result?.destinationTxStatus || response.data.result?.sourceTxStatus || 'PENDING',
        destinationTxHash: response.data.result?.destinationTx,
      };
    } catch (error) {
      return null;
    }
  }
}
