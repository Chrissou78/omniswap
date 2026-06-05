import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';

export interface OneInchConfig extends AdapterConfig {
  apiKey: string;
}

const DEFAULT_CONFIG: Partial<OneInchConfig> = {
  baseUrl: 'https://api.1inch.dev',
  timeout: 30000,
};

export interface OneInchQuoteRequest {
  chainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  slippage: number;
  fromAddress?: string;
  protocols?: string;
  fee?: number;
}

export interface OneInchQuoteResponse {
  fromToken: { symbol: string; name: string; decimals: number; address: string; logoURI?: string };
  toToken: { symbol: string; name: string; decimals: number; address: string; logoURI?: string };
  toAmount: string;
  fromAmount: string;
  protocols: any[];
  estimatedGas: string;
  estimatedPriceImpact?: number;
}

export class OneInchAdapter extends BaseAdapter {
  readonly name = '1inch';
  readonly type = 'DEX' as const;
  readonly supportedChains = ['1', '56', '137', '42161', '10', '8453', '43114'];

  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: OneInchConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig as AdapterConfig);
    this.apiKey = config.apiKey;

    this.client = axios.create({
      baseURL: mergedConfig.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: mergedConfig.timeout || 30000,
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    // 1inch only handles same-chain swaps
    return fromChainId === toChainId && this.supportsChain(fromChainId);
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    const chainId = params.fromChainId || params.inputToken.chainId;
    if (!this.supportsChain(chainId)) {
      logger.warn('Chain not supported by 1inch', { chainId });
      return null;
    }

    try {
      const urlParams = new URLSearchParams({
        src: params.inputToken.address,
        dst: params.outputToken.address,
        amount: params.inputAmount,
        includeProtocols: 'true',
        includeGas: 'true',
      });

      if (params.userAddress) {
        urlParams.append('from', params.userAddress);
      }

      const response = await this.client.get(`/swap/v6.0/${chainId}/quote?${urlParams.toString()}`);
      const data: OneInchQuoteResponse = response.data;

      return {
        outputAmount: data.toAmount,
        minimumOutput: data.toAmount, // Will be adjusted with slippage during swap
        estimatedGas: data.estimatedGas,
        estimatedTime: 30, // ~30 seconds for same-chain
        priceImpact: data.estimatedPriceImpact || 0,
        route: [{
          type: 'SWAP' as const,
          protocol: '1inch',
          chainId,
          inputToken: params.inputToken,
          outputToken: params.outputToken,
          inputAmount: params.inputAmount,
          expectedOutput: data.toAmount,
          minimumOutput: data.toAmount,
          estimatedTime: 30,
        }],
      };
    } catch (error: any) {
      logger.error('1inch quote error', { chainId, error: error.response?.data || error.message });
      return null;
    }
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    const chainId = params.fromChainId || params.inputToken.chainId;
    if (!params.userAddress) throw new Error('userAddress required for swap');

    const urlParams = new URLSearchParams({
      src: params.inputToken.address,
      dst: params.outputToken.address,
      amount: params.inputAmount,
      from: params.userAddress,
      slippage: params.slippage.toString(),
      includeProtocols: 'true',
      includeGas: 'true',
    });

    const response = await this.client.get(`/swap/v6.0/${chainId}/swap?${urlParams.toString()}`);
    const tx = response.data.tx;

    return {
      to: tx.to,
      data: tx.data,
      value: tx.value || '0',
      gasLimit: tx.gas,
    };
  }
}
