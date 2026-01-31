// packages/core/src/adapters/cex/changenow.adapter.ts
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';
import axios, { AxiosInstance } from 'axios';

export interface ChangeNowConfig extends AdapterConfig {
  apiKey: string;
}

// Chain ID to ChangeNOW network mapping
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

export class ChangeNowAdapter extends BaseAdapter {
  readonly name = 'changenow';
  readonly type = 'CEX' as const;
  readonly supportedChains = Object.keys(CHAIN_TO_NETWORK);
  
  private readonly client: AxiosInstance;

  constructor(config: ChangeNowConfig) {
    super(config);
    
    this.client = axios.create({
      baseURL: 'https://api.changenow.io/v2',
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-changenow-api-key': config.apiKey,
      },
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromSupported = this.supportsChain(params.fromChainId);
    const toSupported = this.supportsChain(params.toChainId);
    return fromSupported && toSupported;
  }

  private getNetwork(chainId: string): string | undefined {
    return CHAIN_TO_NETWORK[chainId];
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const fromNetwork = this.getNetwork(params.fromChainId);
      const toNetwork = this.getNetwork(params.toChainId);
      
      const queryParams: any = {
        fromCurrency: (params.fromTokenSymbol || 'eth').toLowerCase(),
        toCurrency: (params.toTokenSymbol || 'eth').toLowerCase(),
        fromAmount: params.amount,
        flow: 'standard',
        type: 'direct',
      };

      if (fromNetwork) queryParams.fromNetwork = fromNetwork;
      if (toNetwork) queryParams.toNetwork = toNetwork;

      const response = await this.client.get('/exchange/estimated-amount', { params: queryParams });

      if (!response.data?.toAmount) {
        return null;
      }

      const estimate = response.data;

      return {
        outputAmount: estimate.toAmount,
        outputAmountMin: estimate.toAmount,
        estimatedGas: '0', // ChangeNOW handles fees internally
        priceImpact: 0,
        route: {
          steps: [
            {
              type: 'cex',
              protocol: 'ChangeNOW',
              fromToken: params.fromTokenSymbol,
              toToken: params.toTokenSymbol,
              fromChainId: params.fromChainId,
              toChainId: params.toChainId,
            },
          ],
          estimatedTimeSeconds: this.parseTimeEstimate(estimate.transactionSpeedForecast),
        },
        metadata: {
          rateId: estimate.rateId,
          validUntil: estimate.validUntil,
          fromNetwork,
          toNetwork,
          warningMessage: estimate.warningMessage,
        },
      };
    } catch (error: any) {
      console.error('[ChangeNOW] Quote error:', error.message);
      return null;
    }
  }

  async getFixedRateQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const fromNetwork = this.getNetwork(params.fromChainId);
      const toNetwork = this.getNetwork(params.toChainId);
      
      const queryParams: any = {
        fromCurrency: (params.fromTokenSymbol || 'eth').toLowerCase(),
        toCurrency: (params.toTokenSymbol || 'eth').toLowerCase(),
        fromAmount: params.amount,
        flow: 'fixed-rate',
        type: 'direct',
      };

      if (fromNetwork) queryParams.fromNetwork = fromNetwork;
      if (toNetwork) queryParams.toNetwork = toNetwork;

      const response = await this.client.get('/exchange/estimated-amount', { params: queryParams });

      if (!response.data?.toAmount) {
        return null;
      }

      const estimate = response.data;

      return {
        outputAmount: estimate.toAmount,
        outputAmountMin: estimate.toAmount,
        estimatedGas: '0',
        priceImpact: 0,
        route: {
          steps: [
            {
              type: 'cex',
              protocol: 'ChangeNOW (Fixed Rate)',
              fromToken: params.fromTokenSymbol,
              toToken: params.toTokenSymbol,
              fromChainId: params.fromChainId,
              toChainId: params.toChainId,
            },
          ],
          estimatedTimeSeconds: this.parseTimeEstimate(estimate.transactionSpeedForecast),
        },
        metadata: {
          rateId: estimate.rateId,
          validUntil: estimate.validUntil,
          fromNetwork,
          toNetwork,
          fixedRate: true,
        },
      };
    } catch (error: any) {
      console.error('[ChangeNOW] Fixed rate quote error:', error.message);
      return null;
    }
  }

  private parseTimeEstimate(forecast?: string): number {
    if (!forecast) return 600;
    // Parse "5-30 minutes" format
    const match = forecast.match(/(\d+)/);
    return match ? parseInt(match[1]) * 60 : 600;
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    throw new Error('ChangeNOW uses deposit flow, not direct transactions. Use createTransaction instead.');
  }

  async createTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult,
    destinationAddress: string,
    options?: {
      extraId?: string;
      refundAddress?: string;
      refundExtraId?: string;
      contactEmail?: string;
    }
  ): Promise<{
    id: string;
    payinAddress: string;
    payinExtraId?: string;
    expectedAmountFrom: string;
    expectedAmountTo: string;
    validUntil?: string;
  } | null> {
    try {
      const fromNetwork = this.getNetwork(params.fromChainId);
      const toNetwork = this.getNetwork(params.toChainId);

      const body: any = {
        fromCurrency: (params.fromTokenSymbol || 'eth').toLowerCase(),
        toCurrency: (params.toTokenSymbol || 'eth').toLowerCase(),
        fromAmount: params.amount,
        address: destinationAddress,
        flow: quote.metadata?.fixedRate ? 'fixed-rate' : 'standard',
      };

      if (fromNetwork) body.fromNetwork = fromNetwork;
      if (toNetwork) body.toNetwork = toNetwork;
      if (quote.metadata?.rateId) body.rateId = quote.metadata.rateId;
      if (options?.extraId) body.extraId = options.extraId;
      if (options?.refundAddress) body.refundAddress = options.refundAddress;
      if (options?.refundExtraId) body.refundExtraId = options.refundExtraId;
      if (options?.contactEmail) body.contactEmail = options.contactEmail;

      const response = await this.client.post('/exchange', body);

      if (!response.data?.id) {
        return null;
      }

      const tx = response.data;

      return {
        id: tx.id,
        payinAddress: tx.payinAddress,
        payinExtraId: tx.payinExtraId,
        expectedAmountFrom: tx.expectedAmountFrom || tx.fromAmount,
        expectedAmountTo: tx.expectedAmountTo || tx.toAmount,
        validUntil: tx.validUntil,
      };
    } catch (error: any) {
      console.error('[ChangeNOW] Create transaction error:', error.message);
      return null;
    }
  }

  async getStatus(transactionId: string): Promise<{
    status: string;
    payinHash?: string;
    payoutHash?: string;
    amountFrom?: string;
    amountTo?: string;
  } | null> {
    try {
      const response = await this.client.get('/exchange/by-id', {
        params: { id: transactionId },
      });

      if (!response.data) {
        return null;
      }

      const tx = response.data;
      return {
        status: tx.status,
        payinHash: tx.payinHash,
        payoutHash: tx.payoutHash,
        amountFrom: tx.amountFrom,
        amountTo: tx.amountTo,
      };
    } catch (error) {
      return null;
    }
  }

  async getMinAmount(
    fromCurrency: string,
    toCurrency: string,
    fromNetwork?: string,
    toNetwork?: string
  ): Promise<string | null> {
    try {
      const params: any = {
        fromCurrency: fromCurrency.toLowerCase(),
        toCurrency: toCurrency.toLowerCase(),
        flow: 'standard',
      };

      if (fromNetwork) params.fromNetwork = fromNetwork;
      if (toNetwork) params.toNetwork = toNetwork;

      const response = await this.client.get('/exchange/min-amount', { params });

      return response.data?.minAmount || null;
    } catch (error) {
      return null;
    }
  }
}
