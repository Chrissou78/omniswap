import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';

export interface LiFiConfig extends AdapterConfig {
  apiKey?: string;
}

const DEFAULT_CONFIG: LiFiConfig = {
  baseUrl: 'https://li.quest/v1',
  timeout: 60000,
};

export interface LiFiToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  priceUSD?: string;
}

export interface LiFiStep {
  id: string;
  type: 'swap' | 'cross' | 'lifi';
  tool: string;
  toolDetails: { key: string; name: string; logoURI?: string };
  action: {
    fromChainId: number;
    fromToken: LiFiToken;
    fromAmount: string;
    toChainId: number;
    toToken: LiFiToken;
    slippage: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    executionDuration: number;
    feeCosts: any[];
    gasCosts: any[];
  };
}

export interface LiFiRoute {
  id: string;
  fromChainId: number;
  fromToken: LiFiToken;
  fromAmount: string;
  fromAmountUSD: string;
  toChainId: number;
  toToken: LiFiToken;
  toAmount: string;
  toAmountMin: string;
  toAmountUSD: string;
  gasCostUSD: string;
  steps: LiFiStep[];
  tags: string[];
}

export class LiFiAdapter extends BaseAdapter {
  readonly name = 'lifi';
  readonly type = 'BRIDGE' as const;
  readonly supportedChains = ['1', '56', '137', '42161', '10', '8453', '43114', '250', '324', '59144', '534352'];

  private client: AxiosInstance;

  constructor(config: Partial<LiFiConfig> = {}) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig);

    this.client = axios.create({
      baseURL: mergedConfig.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(mergedConfig.apiKey ? { 'x-lifi-api-key': mergedConfig.apiKey } : {}),
      },
      timeout: mergedConfig.timeout || 60000,
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    return this.supportsChain(fromChainId) && this.supportsChain(toChainId);
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;

    try {
      const response = await this.client.get('/quote', {
        params: {
          fromChain: fromChainId,
          toChain: toChainId,
          fromToken: params.inputToken.address,
          toToken: params.outputToken.address,
          fromAmount: params.inputAmount,
          fromAddress: params.userAddress || '0x0000000000000000000000000000000000000000',
          slippage: params.slippage / 100 || 0.03,
          integrator: 'omniswap',
        },
      });

      const route: LiFiRoute = response.data;
      if (!route) return null;

      const totalTime = route.steps.reduce((acc, step) => acc + (step.estimate.executionDuration || 0), 0);

      return {
        outputAmount: route.toAmount,
        minimumOutput: route.toAmountMin,
        estimatedGas: route.gasCostUSD,
        estimatedTime: totalTime || 300,
        priceImpact: 0,
        route: route.steps.map((step) => ({
          type: step.type === 'cross' ? 'BRIDGE' : 'SWAP',
          protocol: step.toolDetails?.name || step.tool,
          chainId: step.action.fromChainId.toString(),
          inputToken: params.inputToken,
          outputToken: params.outputToken,
          inputAmount: step.action.fromAmount,
          expectedOutput: step.estimate.toAmount,
          minimumOutput: step.estimate.toAmountMin,
          estimatedTime: step.estimate.executionDuration || 60,
        })),
      };
    } catch (error: any) {
      logger.error('Li.Fi quote error', { fromChainId, toChainId, error: error.response?.data || error.message });
      return null;
    }
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    throw new Error('LiFi buildTransaction requires step data from quote');
  }
}
