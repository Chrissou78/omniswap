// packages/core/src/adapters/bridge/socket.adapter.ts
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';
import axios, { AxiosInstance } from 'axios';

export interface SocketConfig extends AdapterConfig {
  apiKey?: string;
}

const DEFAULT_CONFIG: SocketConfig = {
  baseUrl: 'https://api.socket.tech/v2',
  timeout: 30000,
};

export class SocketAdapter extends BaseAdapter {
  readonly name = 'socket';
  readonly type = 'BRIDGE' as const;
  readonly supportedChains = ['1', '56', '137', '42161', '10', '8453', '43114', '250', '324', '59144', '534352', '5000', '81457'];

  private readonly client: AxiosInstance;

  constructor(config: Partial<SocketConfig> = {}) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig);

    this.client = axios.create({
      baseURL: mergedConfig.baseUrl,
      timeout: mergedConfig.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(mergedConfig.apiKey && { 'API-KEY': mergedConfig.apiKey }),
      },
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    const fromSupported = this.supportsChain(fromChainId);
    const toSupported = this.supportsChain(toChainId);
    const isCrossChain = fromChainId !== toChainId;
    return fromSupported && toSupported && isCrossChain;
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const fromChainId = params.fromChainId || params.inputToken.chainId;
      const toChainId = params.toChainId || params.outputToken.chainId;

      const queryParams: Record<string, any> = {
        fromChainId: parseInt(fromChainId),
        toChainId: parseInt(toChainId),
        fromTokenAddress: params.inputToken.address,
        toTokenAddress: params.outputToken.address,
        fromAmount: params.inputAmount,
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
      const estimatedTime = bestRoute.serviceTime || bestRoute.maxServiceTime || 300;

      return {
        outputAmount: bestRoute.toAmount,
        minimumOutput: bestRoute.toAmount,
        estimatedGas: bestRoute.totalGasFeesInUsd?.toString() || '0',
        estimatedTime,
        priceImpact: 0,
        route: bestRoute.userTxs?.flatMap((tx: any) =>
          tx.steps?.map((step: any) => ({
            type: step.type === 'bridge' ? 'BRIDGE' : 'SWAP',
            protocol: step.protocol?.displayName || step.protocol?.name || 'Socket',
            chainId: step.fromChainId?.toString() || fromChainId,
            inputToken: params.inputToken,
            outputToken: params.outputToken,
            inputAmount: params.inputAmount,
            expectedOutput: bestRoute.toAmount,
            minimumOutput: bestRoute.toAmount,
            estimatedTime,
          })) || []
        ) || [],
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
    throw new Error('Socket buildTransaction requires route metadata');
  }
}
