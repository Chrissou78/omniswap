import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';

export interface JupiterConfig extends AdapterConfig {
  apiKey?: string;
}

const DEFAULT_CONFIG: JupiterConfig = {
  baseUrl: 'https://quote-api.jup.ag/v6',
  timeout: 30000,
};

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippage: number;
  priceImpactPct: number;
  routePlan: { swapInfo: { ammKey: string; label: string; inputMint: string; outputMint: string; inAmount: string; outAmount: string }; percent: number }[];
  contextSlot: number;
  timeTaken: number;
}

export class JupiterAdapter extends BaseAdapter {
  readonly name = 'jupiter';
  readonly type = 'DEX' as const;
  readonly supportedChains = ['solana', '101'];

  private client: AxiosInstance;

  constructor(config: Partial<JupiterConfig> = {}) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig);

    this.client = axios.create({
      baseURL: mergedConfig.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(mergedConfig.apiKey ? { 'Authorization': `Bearer ${mergedConfig.apiKey}` } : {}),
      },
      timeout: mergedConfig.timeout || 30000,
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    // Jupiter only handles Solana same-chain swaps
    return fromChainId === toChainId && this.supportsChain(fromChainId);
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    const chainId = params.fromChainId || params.inputToken.chainId;
    if (!this.supportsChain(chainId)) {
      return null;
    }

    try {
      const urlParams = new URLSearchParams({
        inputMint: params.inputToken.address,
        outputMint: params.outputToken.address,
        amount: params.inputAmount,
        slippageBps: Math.round(params.slippage * 100).toString(),
      });

      const response = await this.client.get(`/quote?${urlParams.toString()}`);
      const data: JupiterQuoteResponse = response.data;

      if (!data) return null;

      return {
        outputAmount: data.outAmount,
        minimumOutput: data.otherAmountThreshold,
        estimatedTime: 30, // Solana is fast
        priceImpact: data.priceImpactPct || 0,
        route: data.routePlan?.map((step) => ({
          type: 'SWAP' as const,
          protocol: step.swapInfo.label || 'Jupiter',
          chainId,
          inputToken: params.inputToken,
          outputToken: params.outputToken,
          inputAmount: step.swapInfo.inAmount,
          expectedOutput: step.swapInfo.outAmount,
          minimumOutput: data.otherAmountThreshold,
          estimatedTime: 30,
        })) || [],
      };
    } catch (error: any) {
      logger.error('Jupiter quote error', { error: error.response?.data || error.message });
      return null;
    }
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    throw new Error('Jupiter requires Solana-specific transaction building');
  }
}
