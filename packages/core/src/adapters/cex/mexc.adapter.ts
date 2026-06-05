// packages/core/src/adapters/cex/mexc.adapter.ts
import crypto from 'crypto';
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';

interface MEXCTickerResponse {
  symbol: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  volume: string;
}

const CHAIN_TO_NETWORK: Record<string, string> = {
  '1': 'ERC20',
  'ethereum': 'ERC20',
  '42161': 'ARBITRUM',
  'arbitrum': 'ARBITRUM',
  '10': 'OPTIMISM',
  'optimism': 'OPTIMISM',
  '137': 'MATIC',
  'polygon': 'MATIC',
  '56': 'BEP20',
  'bsc': 'BEP20',
  '43114': 'AVAX_CCHAIN',
  'avalanche': 'AVAX_CCHAIN',
  '8453': 'BASE',
  'base': 'BASE',
  'solana': 'SOL',
  '101': 'SOL',
  'sui': 'SUI',
  '784': 'SUI',
};

export interface MEXCConfig extends AdapterConfig {
  apiKey: string;
  secretKey: string;
}

const DEFAULT_CONFIG: Partial<MEXCConfig> = {
  baseUrl: 'https://api.mexc.com',
  timeout: 30000,
};

export class MEXCAdapter extends BaseAdapter {
  readonly name = 'MEXC';
  readonly type = 'CEX' as const;
  readonly supportedChains = ['1', '42161', '10', '137', '56', '43114', '8453', 'solana', 'sui', '101', '784'];

  private apiKey: string;
  private secretKey: string;

  constructor(config: MEXCConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig as AdapterConfig);
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    return this.supportsChain(fromChainId) && this.supportsChain(toChainId);
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      const inputSymbol = params.inputToken.symbol.toUpperCase();
      const outputSymbol = params.outputToken.symbol.toUpperCase();

      const tradingRoute = await this.findTradingRoute(inputSymbol, outputSymbol);
      if (!tradingRoute) {
        console.warn(`[MEXC] No trading route found for ${inputSymbol} -> ${outputSymbol}`);
        return null;
      }

      const outputAmount = await this.calculateOutputAmount(
        tradingRoute,
        params.inputAmount,
        params.inputToken.decimals,
        params.outputToken.decimals
      );

      if (!outputAmount) return null;

      const fromChainId = params.fromChainId || params.inputToken.chainId;
      const toChainId = params.toChainId || params.outputToken.chainId;
      const estimatedTime = this.estimateTime(fromChainId, toChainId);

      const slippageMultiplier = 1 - (params.slippage / 100);
      const minimumOutput = (parseFloat(outputAmount) * slippageMultiplier).toString();

      return {
        outputAmount,
        minimumOutput,
        estimatedTime,
        priceImpact: 0.1,
        route: [{
          type: 'CEX_TRADE' as const,
          protocol: 'MEXC',
          chainId: fromChainId,
          inputToken: params.inputToken,
          outputToken: params.outputToken,
          inputAmount: params.inputAmount,
          expectedOutput: outputAmount,
          minimumOutput,
          estimatedTime,
        }],
      };
    } catch (error) {
      console.error(`[MEXC] Quote error:`, error);
      return null;
    }
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    throw new Error('MEXC requires deposit/trade/withdraw flow');
  }

  private async findTradingRoute(inputSymbol: string, outputSymbol: string): Promise<string[] | null> {
    const directPairs = [`${inputSymbol}${outputSymbol}`, `${outputSymbol}${inputSymbol}`];
    for (const pair of directPairs) {
      if (await this.pairExists(pair)) return [pair];
    }

    const viaUSDT = [`${inputSymbol}USDT`, `${outputSymbol}USDT`];
    const [hasInputUSDT, hasOutputUSDT] = await Promise.all([
      this.pairExists(viaUSDT[0]),
      this.pairExists(viaUSDT[1]),
    ]);
    if (hasInputUSDT && hasOutputUSDT) return viaUSDT;

    return null;
  }

  private async pairExists(symbol: string): Promise<boolean> {
    try {
      const response = await this.fetchJson<MEXCTickerResponse>(
        `${this.config.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`
      );
      return !!response.lastPrice;
    } catch {
      return false;
    }
  }

  private async calculateOutputAmount(
    route: string[],
    inputAmount: string,
    inputDecimals: number,
    outputDecimals: number
  ): Promise<string | null> {
    try {
      let currentAmount = parseFloat(inputAmount) / Math.pow(10, inputDecimals);

      for (const pair of route) {
        const ticker = await this.fetchJson<MEXCTickerResponse>(
          `${this.config.baseUrl}/api/v3/ticker/24hr?symbol=${pair}`
        );
        currentAmount = currentAmount * parseFloat(ticker.lastPrice);
      }

      return Math.floor(currentAmount * Math.pow(10, outputDecimals)).toString();
    } catch {
      return null;
    }
  }

  private sign(queryString: string): string {
    return crypto.createHmac('sha256', this.secretKey).update(queryString).digest('hex');
  }

  private estimateTime(fromChain: string, toChain: string): number {
    const depositTimes: Record<string, number> = {
      '1': 300, 'ethereum': 300, '42161': 60, 'arbitrum': 60, '10': 60, 'optimism': 60,
      '137': 120, 'polygon': 120, '56': 60, 'bsc': 60, '43114': 30, 'avalanche': 30,
      '8453': 60, 'base': 60, 'solana': 30, '101': 30, 'sui': 15, '784': 15,
    };
    const depositTime = depositTimes[fromChain] || 300;
    const withdrawTime = depositTimes[toChain] || 300;
    return depositTime + 10 + withdrawTime + 60;
  }
}
