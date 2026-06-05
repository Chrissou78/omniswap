// packages/core/src/adapters/bridge/rango.adapter.ts
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';
import axios, { AxiosInstance } from 'axios';

export interface RangoConfig extends AdapterConfig {
  apiKey?: string;
}

const CHAIN_TO_BLOCKCHAIN: Record<string, string> = {
  '1': 'ETH',
  '56': 'BSC',
  '137': 'POLYGON',
  '42161': 'ARBITRUM',
  '10': 'OPTIMISM',
  '8453': 'BASE',
  '43114': 'AVAX_CCHAIN',
  '250': 'FANTOM',
  '324': 'ZKSYNC',
  '59144': 'LINEA',
  '534352': 'SCROLL',
  '5000': 'MANTLE',
  '81457': 'BLAST',
  '101': 'SOLANA',
  '784': 'SUI',
};

const BLOCKCHAIN_TO_CHAIN: Record<string, string> = Object.entries(CHAIN_TO_BLOCKCHAIN)
  .reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {});

const DEFAULT_CONFIG: RangoConfig = {
  baseUrl: 'https://api.rango.exchange',
  timeout: 45000,
};

export class RangoAdapter extends BaseAdapter {
  readonly name = 'rango';
  readonly type = 'BRIDGE' as const;
  readonly supportedChains = Object.keys(CHAIN_TO_BLOCKCHAIN);

  private readonly client: AxiosInstance;

  constructor(config: Partial<RangoConfig> = {}) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig);

    this.client = axios.create({
      baseURL: mergedConfig.baseUrl,
      timeout: mergedConfig.timeout || 45000,
      headers: {
        'Content-Type': 'application/json',
        ...(mergedConfig.apiKey && { 'API-KEY': mergedConfig.apiKey }),
      },
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    return this.supportsChain(fromChainId) && this.supportsChain(toChainId);
  }

  private formatToken(chainId: string, address: string, symbol: string): string {
    const blockchain = CHAIN_TO_BLOCKCHAIN[chainId];
    if (!blockchain) return '';

    const isNative = !address ||
      address === '0x0000000000000000000000000000000000000000' ||
      address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    return isNative ? `${blockchain}.${symbol}` : `${blockchain}.${symbol}--${address}`;
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const fromChainId = params.fromChainId || params.inputToken.chainId;
      const toChainId = params.toChainId || params.outputToken.chainId;
      const fromBlockchain = CHAIN_TO_BLOCKCHAIN[fromChainId];
      const toBlockchain = CHAIN_TO_BLOCKCHAIN[toChainId];

      if (!fromBlockchain || !toBlockchain) return null;

      const queryParams: Record<string, string> = {
        from: this.formatToken(fromChainId, params.inputToken.address, params.inputToken.symbol),
        to: this.formatToken(toChainId, params.outputToken.address, params.outputToken.symbol),
        amount: params.inputAmount,
        slippage: (params.slippage || 1).toString(),
        enableCentralizedSwappers: 'true',
      };

      if (params.userAddress) {
        queryParams.fromAddress = params.userAddress;
        queryParams.toAddress = params.userAddress;
      }

      const response = await this.client.get('/routing/best', { params: queryParams });

      if (response.data.resultType !== 'OK' || !response.data.route) return null;

      const route = response.data.route;

      return {
        outputAmount: route.outputAmount,
        minimumOutput: route.outputAmountMin || route.outputAmount,
        estimatedGas: route.feeUsd?.toString() || '0',
        estimatedTime: route.estimatedTimeInSeconds || 300,
        priceImpact: 0,
        route: route.path?.map((step: any) => ({
          type: step.swapperType === 'BRIDGE' ? 'BRIDGE' : 'SWAP',
          protocol: step.swapper?.title || step.swapper?.id || 'Rango',
          chainId: BLOCKCHAIN_TO_CHAIN[step.from?.blockchain] || fromChainId,
          inputToken: params.inputToken,
          outputToken: params.outputToken,
          inputAmount: params.inputAmount,
          expectedOutput: route.outputAmount,
          minimumOutput: route.outputAmountMin || route.outputAmount,
          estimatedTime: route.estimatedTimeInSeconds || 300,
        })) || [],
      };
    } catch (error: any) {
      console.error('[Rango] Quote error:', error.message);
      return null;
    }
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    throw new Error('Rango buildTransaction requires requestId from quote metadata');
  }
}
