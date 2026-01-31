// packages/core/src/adapters/bridge/rango.adapter.ts
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';
import axios, { AxiosInstance } from 'axios';

export interface RangoConfig extends AdapterConfig {
  apiKey?: string;
}

// Chain ID to Rango blockchain name mapping
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

export class RangoAdapter extends BaseAdapter {
  readonly name = 'rango';
  readonly type = 'BRIDGE' as const;
  readonly supportedChains = Object.keys(CHAIN_TO_BLOCKCHAIN);
  
  private readonly client: AxiosInstance;

  constructor(config: RangoConfig = {}) {
    super(config);
    
    this.client = axios.create({
      baseURL: 'https://api.rango.exchange',
      timeout: this.config.timeout || 45000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'API-KEY': config.apiKey }),
      },
    });
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromSupported = this.supportsChain(params.fromChainId);
    const toSupported = this.supportsChain(params.toChainId);
    // Rango handles both same-chain and cross-chain
    return fromSupported && toSupported;
  }

  private formatToken(
    chainId: string,
    address: string,
    symbol: string
  ): string {
    const blockchain = CHAIN_TO_BLOCKCHAIN[chainId];
    if (!blockchain) return '';
    
    const isNative = !address || 
      address === '0x0000000000000000000000000000000000000000' ||
      address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    
    if (isNative) {
      return `${blockchain}.${symbol}`;
    }
    return `${blockchain}.${symbol}--${address}`;
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const fromBlockchain = CHAIN_TO_BLOCKCHAIN[params.fromChainId];
      const toBlockchain = CHAIN_TO_BLOCKCHAIN[params.toChainId];
      
      if (!fromBlockchain || !toBlockchain) {
        return null;
      }

      const queryParams: any = {
        from: this.formatToken(params.fromChainId, params.fromTokenAddress, params.fromTokenSymbol || 'TOKEN'),
        to: this.formatToken(params.toChainId, params.toTokenAddress, params.toTokenSymbol || 'TOKEN'),
        amount: params.amount,
        slippage: (params.slippage || 1).toString(),
        enableCentralizedSwappers: true,
      };

      if (params.userAddress) {
        queryParams.fromAddress = params.userAddress;
        queryParams.toAddress = params.recipient || params.userAddress;
      }

      const response = await this.client.get('/routing/best', { params: queryParams });

      if (response.data.resultType !== 'OK' || !response.data.route) {
        return null;
      }

      const route = response.data.route;
      
      const steps = route.path?.map((step: any) => ({
        type: step.swapperType === 'BRIDGE' ? 'bridge' : 'swap',
        protocol: step.swapper?.title || step.swapper?.id || 'Rango',
        fromToken: step.from?.symbol,
        toToken: step.to?.symbol,
        fromChainId: BLOCKCHAIN_TO_CHAIN[step.from?.blockchain] || params.fromChainId,
        toChainId: BLOCKCHAIN_TO_CHAIN[step.to?.blockchain] || params.toChainId,
      })) || [];

      return {
        outputAmount: route.outputAmount,
        outputAmountMin: route.outputAmountMin || route.outputAmount,
        estimatedGas: route.feeUsd?.toString() || '0',
        priceImpact: 0,
        route: {
          steps,
          estimatedTimeSeconds: route.estimatedTimeInSeconds || 300,
        },
        metadata: {
          requestId: response.data.requestId,
          swapper: route.swapper?.title,
          outputAmountUsd: route.outputAmountUsd,
          feeUsd: route.feeUsd,
          rawRoute: response.data,
        },
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
    try {
      const requestId = quote.metadata?.requestId;
      if (!requestId) {
        throw new Error('No request ID in quote');
      }

      const response = await this.client.post('/tx/create', {
        requestId,
        step: 1,
        userSettings: {
          slippage: (params.slippage || 1).toString(),
          infiniteApprove: false,
        },
        validations: {
          balance: true,
          fee: true,
          approve: true,
        },
      });

      if (response.data.resultType !== 'OK' || !response.data.tx) {
        throw new Error(response.data.error || 'Failed to create transaction');
      }

      const tx = response.data.tx;

      return {
        to: tx.to || tx.txTo,
        data: tx.data || tx.txData,
        value: tx.value || '0',
        gasLimit: tx.gasLimit,
      };
    } catch (error: any) {
      console.error('[Rango] Build transaction error:', error.message);
      throw error;
    }
  }

  async getStatus(
    requestId: string,
    txHash: string,
    step: number = 1
  ): Promise<{ status: string; output?: any } | null> {
    try {
      const response = await this.client.get('/tx/check-status', {
        params: { requestId, txId: txHash, step },
      });

      return {
        status: response.data.status || 'PENDING',
        output: response.data.output,
      };
    } catch (error) {
      return null;
    }
  }
}
