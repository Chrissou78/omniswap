import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface CetusQuoteRequest {
  inputCoin: string;
  outputCoin: string;
  amount: string;
  slippageBps: number;
  byAmountIn?: boolean;
}

export interface CetusQuoteResponse {
  inputCoin: string;
  outputCoin: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactBps: number;
  estimatedGas: string;
  route: CetusRouteStep[];
  rawQuote: any;
}

export interface CetusRouteStep {
  poolId: string;
  coinTypeA: string;
  coinTypeB: string;
  amountIn: string;
  amountOut: string;
  aToB: boolean;
}

export interface CetusSwapRequest {
  quote: CetusQuoteResponse;
  senderAddress: string;
  slippageBps: number;
}

export class CetusAdapter {
  private client: AxiosInstance;
  private readonly SUI_COIN_TYPE = '0x2::sui::SUI';

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api-sui.cetus.zone',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async getQuote(request: CetusQuoteRequest): Promise<CetusQuoteResponse | null> {
    try {
      // Format coin types
      const inputCoin = this.formatCoinType(request.inputCoin);
      const outputCoin = this.formatCoinType(request.outputCoin);

      const response = await this.client.post('/v2/sui/swap/calculate', {
        coinTypeA: inputCoin,
        coinTypeB: outputCoin,
        amount: request.amount,
        byAmountIn: request.byAmountIn ?? true,
        slippage: request.slippageBps / 10000,
      });

      if (!response.data || response.data.code !== 0) {
        logger.warn('Cetus quote returned error', { data: response.data });
        return null;
      }

      const data = response.data.data;

      return {
        inputCoin,
        outputCoin,
        inputAmount: request.amount,
        outputAmount: data.estimatedAmountOut || data.amountOut,
        priceImpactBps: Math.round((data.priceImpact || 0) * 10000),
        estimatedGas: data.estimatedGas || '1000000',
        route: data.routes?.map((r: any) => ({
          poolId: r.poolAddress,
          coinTypeA: r.coinTypeA,
          coinTypeB: r.coinTypeB,
          amountIn: r.amountIn,
          amountOut: r.amountOut,
          aToB: r.a2b,
        })) || [],
        rawQuote: data,
      };
    } catch (error: any) {
      logger.error('Cetus quote error', {
        inputCoin: request.inputCoin,
        outputCoin: request.outputCoin,
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async buildSwapTransaction(request: CetusSwapRequest): Promise<{
    txBytes: string;
    estimatedGas: string;
  } | null> {
    try {
      const response = await this.client.post('/v2/sui/swap/build-transaction', {
        routes: request.quote.route,
        coinTypeA: request.quote.inputCoin,
        coinTypeB: request.quote.outputCoin,
        amountIn: request.quote.inputAmount,
        minAmountOut: this.calculateMinOutput(
          request.quote.outputAmount,
          request.slippageBps
        ),
        sender: request.senderAddress,
        slippage: request.slippageBps / 10000,
      });

      if (!response.data || response.data.code !== 0) {
        logger.warn('Cetus build transaction error', { data: response.data });
        return null;
      }

      return {
        txBytes: response.data.data.txBytes,
        estimatedGas: response.data.data.estimatedGas,
      };
    } catch (error: any) {
      logger.error('Cetus build transaction error', {
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async getPools(): Promise<any[]> {
    try {
      const response = await this.client.get('/v2/sui/pools');
      return response.data?.data?.pools || [];
    } catch (error) {
      logger.error('Cetus pools error', { error });
      return [];
    }
  }

  async getTokens(): Promise<any[]> {
    try {
      const response = await this.client.get('/v2/sui/tokens');
      return response.data?.data?.tokens || [];
    } catch (error) {
      logger.error('Cetus tokens error', { error });
      return [];
    }
  }

  private formatCoinType(coinType: string): string {
    // Handle native SUI
    if (coinType.toLowerCase() === 'sui' || coinType === '0x2::sui::SUI') {
      return this.SUI_COIN_TYPE;
    }
    // Ensure proper format
    if (!coinType.startsWith('0x')) {
      return `0x${coinType}`;
    }
    return coinType;
  }

  private calculateMinOutput(outputAmount: string, slippageBps: number): string {
    const amount = BigInt(outputAmount);
    const slippage = BigInt(slippageBps);
    const minOutput = amount - (amount * slippage / 10000n);
    return minOutput.toString();
  }
}
