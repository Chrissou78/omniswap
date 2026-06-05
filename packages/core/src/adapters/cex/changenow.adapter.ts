// packages/core/src/adapters/cex/changenow.adapter.ts
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';
import axios, { AxiosInstance } from 'axios';

export interface ChangeNowConfig extends AdapterConfig {
  apiKey: string;
}

const CHAIN_TO_NETWORK: Record<string, string> = {
  '1': 'eth',
  '56': 'bsc',
  '137': 'matic',
  '42161': 'arbitrum',
  '10': 'op',
  '8453': 'base',
  '43114': 'avaxc',
  '250': 'ftm',
  '324': 'zksync',
  '59144': 'linea',
};

const DEFAULT_CONFIG: Partial<ChangeNowConfig> = {
  baseUrl: 'https://api.changenow.io/v2',
  timeout: 30000,
};

export class ChangeNowAdapter extends BaseAdapter {
  readonly name = 'changenow';
  readonly type = 'CEX' as const;
  readonly supportedChains = Object.keys(CHAIN_TO_NETWORK);

  private readonly client: AxiosInstance;

  constructor(config: ChangeNowConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig as AdapterConfig);

    this.client = axios.create({
      baseURL: mergedConfig.baseUrl,
      timeout: mergedConfig.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-changenow-api-key': config.apiKey,
      },
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    return this.supportsChain(fromChainId) && this.supportsChain(toChainId);
  }

  private getNetwork(chainId: string): string | undefined {
    return CHAIN_TO_NETWORK[chainId];
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const fromChainId = params.fromChainId || params.inputToken.chainId;
      const toChainId = params.toChainId || params.outputToken.chainId;
      const fromNetwork = this.getNetwork(fromChainId);
      const toNetwork = this.getNetwork(toChainId);

      const queryParams: Record<string, string> = {
        fromCurrency: params.inputToken.symbol.toLowerCase(),
        toCurrency: params.outputToken.symbol.toLowerCase(),
        fromAmount: params.inputAmount,
        flow: 'standard',
        type: 'direct',
      };

      if (fromNetwork) queryParams.fromNetwork = fromNetwork;
      if (toNetwork) queryParams.toNetwork = toNetwork;

      const response = await this.client.get('/exchange/estimated-amount', { params: queryParams });

      if (!response.data?.toAmount) return null;

      const estimate = response.data;
      const estimatedTime = this.parseTimeEstimate(estimate.transactionSpeedForecast);

      return {
        outputAmount: estimate.toAmount.toString(),
        minimumOutput: estimate.toAmount.toString(),
        estimatedTime,
        priceImpact: 0,
        route: [{
          type: 'CEX_TRADE' as const,
          protocol: 'ChangeNOW',
          chainId: fromChainId,
          inputToken: params.inputToken,
          outputToken: params.outputToken,
          inputAmount: params.inputAmount,
          expectedOutput: estimate.toAmount.toString(),
          minimumOutput: estimate.toAmount.toString(),
          estimatedTime,
        }],
      };
    } catch (error: any) {
      console.error('[ChangeNOW] Quote error:', error.message);
      return null;
    }
  }

  private parseTimeEstimate(forecast?: string): number {
    if (!forecast) return 600;
    const match = forecast.match(/(\d+)/);
    return match ? parseInt(match[1]) * 60 : 600;
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    throw new Error('ChangeNOW uses deposit flow, not direct transactions');
  }
}
