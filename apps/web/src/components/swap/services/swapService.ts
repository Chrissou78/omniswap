// apps/web/src/components/swap/services/swapService.ts

import { QuoteResponse, SwapRoute } from '../types';
import chainsData from '@/config/chains.json';

interface QuoteParams {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  chainId: number;
  slippage: number;
  userAddress?: string;
  affiliateAddress?: string;
  affiliateFee?: number;
  routeTypes?: string[];
}

interface SwapParams {
  quote: QuoteResponse;
  userAddress: string;
  slippage: number;
  deadline: number;
}

interface SwapResponse {
  hash?: string;
  error?: string;
}

// DEX Aggregator APIs by chain
const DEX_AGGREGATORS: Record<number, { name: string; quoteUrl: string; swapUrl: string }[]> = {
  // Ethereum
  1: [
    { name: '0x', quoteUrl: 'https://api.0x.org/swap/v1/quote', swapUrl: 'https://api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/1/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/1/swap' },
  ],
  // BSC
  56: [
    { name: '0x', quoteUrl: 'https://bsc.api.0x.org/swap/v1/quote', swapUrl: 'https://bsc.api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/56/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/56/swap' },
  ],
  // Polygon
  137: [
    { name: '0x', quoteUrl: 'https://polygon.api.0x.org/swap/v1/quote', swapUrl: 'https://polygon.api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/137/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/137/swap' },
  ],
  // Arbitrum
  42161: [
    { name: '0x', quoteUrl: 'https://arbitrum.api.0x.org/swap/v1/quote', swapUrl: 'https://arbitrum.api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/42161/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/42161/swap' },
  ],
  // Optimism
  10: [
    { name: '0x', quoteUrl: 'https://optimism.api.0x.org/swap/v1/quote', swapUrl: 'https://optimism.api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/10/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/10/swap' },
  ],
  // Avalanche
  43114: [
    { name: '0x', quoteUrl: 'https://avalanche.api.0x.org/swap/v1/quote', swapUrl: 'https://avalanche.api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/43114/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/43114/swap' },
  ],
  // Base
  8453: [
    { name: '0x', quoteUrl: 'https://base.api.0x.org/swap/v1/quote', swapUrl: 'https://base.api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/8453/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/8453/swap' },
  ],
  // Fantom
  250: [
    { name: '0x', quoteUrl: 'https://fantom.api.0x.org/swap/v1/quote', swapUrl: 'https://fantom.api.0x.org/swap/v1/quote' },
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/250/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/250/swap' },
  ],
  // zkSync
  324: [
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/324/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/324/swap' },
  ],
  // Linea
  59144: [
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/59144/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/59144/swap' },
  ],
  // Scroll
  534352: [
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/534352/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/534352/swap' },
  ],
  // Mantle
  5000: [
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/5000/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/5000/swap' },
  ],
  // Blast
  81457: [
    { name: '1inch', quoteUrl: 'https://api.1inch.dev/swap/v5.2/81457/quote', swapUrl: 'https://api.1inch.dev/swap/v5.2/81457/swap' },
  ],
};

// Native token address representations
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

class SwapService {
  private apiKeys: Record<string, string> = {};

  constructor() {
    // Load API keys from environment
    if (typeof window !== 'undefined') {
      this.apiKeys = {
        '0x': process.env.NEXT_PUBLIC_0X_API_KEY || '',
        '1inch': process.env.NEXT_PUBLIC_1INCH_API_KEY || '',
        'paraswap': process.env.NEXT_PUBLIC_PARASWAP_API_KEY || '',
      };
    }
  }

  /**
   * Get quote from multiple DEX aggregators
   */
  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    const { inputToken, outputToken, inputAmount, chainId, slippage, userAddress, routeTypes } = params;

    // Get available aggregators for this chain
    const aggregators = DEX_AGGREGATORS[chainId];
    
    if (!aggregators || aggregators.length === 0) {
      // Fallback to price-based estimation
      return this.getEstimatedQuote(params);
    }

    const routes: SwapRoute[] = [];
    const errors: string[] = [];

    // Try each aggregator in parallel
    const quotePromises = aggregators.map(async (aggregator) => {
      try {
        const route = await this.getAggregatorQuote(aggregator, params);
        if (route) {
          routes.push(route);
        }
      } catch (error: any) {
        console.warn(`${aggregator.name} quote failed:`, error.message);
        errors.push(`${aggregator.name}: ${error.message}`);
      }
    });

    await Promise.allSettled(quotePromises);

    if (routes.length === 0) {
      // All aggregators failed, return estimated quote
      console.warn('All aggregators failed, using estimated quote');
      return this.getEstimatedQuote(params);
    }

    // Sort routes by output amount (best first)
    routes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    const bestRoute = routes[0];

    return {
      inputToken,
      outputToken,
      inputAmount,
      outputAmount: bestRoute.outputAmount,
      routes,
      selectedRoute: bestRoute,
      estimatedGas: bestRoute.estimatedGas,
      priceImpact: bestRoute.priceImpact,
    };
  }

  /**
   * Get quote from a specific aggregator
   */
  private async getAggregatorQuote(
    aggregator: { name: string; quoteUrl: string },
    params: QuoteParams
  ): Promise<SwapRoute | null> {
    const { inputToken, outputToken, inputAmount, chainId, slippage, userAddress } = params;

    // Normalize addresses
    const sellToken = this.normalizeTokenAddress(inputToken);
    const buyToken = this.normalizeTokenAddress(outputToken);

    // Convert amount to wei (assuming 18 decimals for now)
    const sellAmount = this.toWei(inputAmount, 18);

    let response: Response;
    let data: any;

    if (aggregator.name === '0x') {
      const url = new URL(aggregator.quoteUrl);
      url.searchParams.set('sellToken', sellToken);
      url.searchParams.set('buyToken', buyToken);
      url.searchParams.set('sellAmount', sellAmount);
      url.searchParams.set('slippagePercentage', (slippage / 100).toString());
      if (userAddress) {
        url.searchParams.set('takerAddress', userAddress);
      }

      response = await fetch(url.toString(), {
        headers: this.apiKeys['0x'] ? { '0x-api-key': this.apiKeys['0x'] } : {},
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.reason || `0x API error: ${response.status}`);
      }

      data = await response.json();

      return {
        source: '0x',
        inputAmount,
        outputAmount: this.fromWei(data.buyAmount, 18),
        path: data.sources?.map((s: any) => s.name) || ['0x'],
        estimatedGas: data.estimatedGas,
        priceImpact: data.estimatedPriceImpact ? parseFloat(data.estimatedPriceImpact) : undefined,
        tx: data.to ? {
          to: data.to,
          data: data.data,
          value: data.value,
          gasLimit: data.gas,
        } : undefined,
      };
    }

    if (aggregator.name === '1inch') {
      const url = new URL(aggregator.quoteUrl);
      url.searchParams.set('src', sellToken);
      url.searchParams.set('dst', buyToken);
      url.searchParams.set('amount', sellAmount);

      response = await fetch(url.toString(), {
        headers: this.apiKeys['1inch'] 
          ? { 'Authorization': `Bearer ${this.apiKeys['1inch']}` }
          : {},
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || `1inch API error: ${response.status}`);
      }

      data = await response.json();

      return {
        source: '1inch',
        inputAmount,
        outputAmount: this.fromWei(data.toAmount || data.dstAmount, 18),
        path: data.protocols?.[0]?.map((p: any) => p[0]?.name).filter(Boolean) || ['1inch'],
        estimatedGas: data.gas,
        priceImpact: undefined,
      };
    }

    return null;
  }

  /**
   * Get estimated quote based on price data (fallback)
   */
  private async getEstimatedQuote(params: QuoteParams): Promise<QuoteResponse> {
    const { inputToken, outputToken, inputAmount, chainId, slippage } = params;

    // Import price service dynamically to avoid circular deps
    const { priceService } = await import('@/services/priceService');

    // Get prices for both tokens
    const [inputPrice, outputPrice] = await Promise.all([
      priceService.getTokenPrice(inputToken, chainId),
      priceService.getTokenPrice(outputToken, chainId),
    ]);

    if (!inputPrice || !outputPrice) {
      throw new Error('Unable to fetch token prices for quote estimation');
    }

    // Calculate output amount
    const inputValue = parseFloat(inputAmount) * inputPrice;
    const outputAmount = inputValue / outputPrice;
    
    // Apply slippage
    const outputWithSlippage = outputAmount * (1 - slippage / 100);

    return {
      inputToken,
      outputToken,
      inputAmount,
      outputAmount: outputWithSlippage.toFixed(8),
      routes: [{
        source: 'Estimated',
        inputAmount,
        outputAmount: outputWithSlippage.toFixed(8),
        path: ['Price Estimate'],
        estimatedGas: '200000',
        priceImpact: slippage,
      }],
      selectedRoute: undefined,
      estimatedGas: '200000',
      priceImpact: slippage,
    };
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(params: SwapParams): Promise<SwapResponse> {
    const { quote, userAddress, slippage, deadline } = params;

    if (!quote.selectedRoute?.tx) {
      throw new Error('No transaction data available. Please refresh quote.');
    }

    const tx = quote.selectedRoute.tx;

    // Return transaction params for wallet to execute
    return {
      hash: undefined, // Will be set by the calling component after tx is sent
      ...tx,
    };
  }

  /**
   * Build swap transaction for a specific route
   */
  async buildSwapTransaction(
    route: SwapRoute,
    userAddress: string,
    slippage: number,
    deadline: number,
    chainId: number
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    const aggregators = DEX_AGGREGATORS[chainId];
    const aggregator = aggregators?.find(a => a.name === route.source);

    if (!aggregator) {
      throw new Error(`No aggregator found for ${route.source}`);
    }

    if (aggregator.name === '0x') {
      // 0x quote endpoint already returns tx data
      if (route.tx) {
        return {
          to: route.tx.to!,
          data: route.tx.data!,
          value: route.tx.value || '0',
          gasLimit: route.tx.gasLimit,
        };
      }
    }

    if (aggregator.name === '1inch') {
      // Fetch swap transaction from 1inch
      const url = new URL(aggregator.swapUrl);
      url.searchParams.set('src', route.inputAmount); // These should be addresses
      url.searchParams.set('dst', route.outputAmount);
      url.searchParams.set('amount', this.toWei(route.inputAmount, 18));
      url.searchParams.set('from', userAddress);
      url.searchParams.set('slippage', slippage.toString());

      const response = await fetch(url.toString(), {
        headers: this.apiKeys['1inch']
          ? { 'Authorization': `Bearer ${this.apiKeys['1inch']}` }
          : {},
      });

      if (!response.ok) {
        throw new Error('Failed to build swap transaction');
      }

      const data = await response.json();

      return {
        to: data.tx.to,
        data: data.tx.data,
        value: data.tx.value,
        gasLimit: data.tx.gas,
      };
    }

    throw new Error('Unable to build transaction');
  }

  /**
   * Normalize token address (handle native tokens)
   */
  private normalizeTokenAddress(address: string): string {
    if (
      address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
      address.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
      address.toLowerCase() === 'eth' ||
      address.toLowerCase() === 'native'
    ) {
      return NATIVE_TOKEN_ADDRESS;
    }
    return address;
  }

  /**
   * Convert amount to wei
   */
  private toWei(amount: string, decimals: number): string {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    const wei = whole + paddedFraction;
    return wei.replace(/^0+/, '') || '0';
  }

  /**
   * Convert wei to amount
   */
  private fromWei(wei: string, decimals: number): string {
    const weiStr = wei.toString().padStart(decimals + 1, '0');
    const whole = weiStr.slice(0, -decimals) || '0';
    const fraction = weiStr.slice(-decimals).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): number[] {
    return Object.keys(DEX_AGGREGATORS).map(Number);
  }

  /**
   * Check if chain is supported for swaps
   */
  isChainSupported(chainId: number): boolean {
    return chainId in DEX_AGGREGATORS;
  }
}

export const swapService = new SwapService();
export default swapService;
