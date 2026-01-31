// apps/mobile/src/services/quoteService.ts
import { Token, Chain } from './configService';
import { priceService } from './priceService';
import axios from 'axios';

// ============================================================================
// Types
// ============================================================================

export interface Quote {
  id: string;
  provider: string;
  providerLogo?: string;
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  outputAmount: string;
  outputAmountDisplay: string;
  outputAmountUsd: number;
  exchangeRate: number;
  exchangeRateDisplay: string;
  inputValueUsd: number;
  outputValueUsd: number;
  priceImpact: number;
  estimatedGas?: string;
  estimatedGasUsd?: number;
  estimatedTimeSeconds?: number;
  isEstimated: boolean;
  isBestRate?: boolean;
  route?: RouteStep[];
  metadata?: any;
}

export interface RouteStep {
  type: 'swap' | 'bridge' | 'cex';
  protocol: string;
  fromToken?: string;
  toToken?: string;
  fromChainId?: string;
  toChainId?: string;
}

export interface QuoteRequest {
  inputToken: Token;
  outputToken: Token;
  inputChain: Chain;
  outputChain: Chain;
  inputAmount: string;
  userAddress?: string;
  slippage?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: 'dex' | 'bridge' | 'cex';
  supportedChains: string[];
}

// ============================================================================
// Provider Configurations
// ============================================================================

const PROVIDER_CONFIGS: ProviderConfig[] = [
  { 
    id: 'lifi', 
    name: 'LI.FI', 
    enabled: true, 
    type: 'bridge',
    supportedChains: ['1', '56', '137', '42161', '10', '8453', '43114', '250', '324', '59144']
  },
  { 
    id: '1inch', 
    name: '1inch', 
    enabled: true, 
    type: 'dex',
    supportedChains: ['1', '56', '137', '42161', '10', '8453', '43114', '250', '324']
  },
  { 
    id: 'jupiter', 
    name: 'Jupiter', 
    enabled: true, 
    type: 'dex',
    supportedChains: ['101'] // Solana
  },
  { 
    id: 'socket', 
    name: 'Socket', 
    enabled: true, 
    type: 'bridge',
    supportedChains: ['1', '56', '137', '42161', '10', '8453', '43114', '250', '324', '59144', '534352']
  },
  { 
    id: 'rango', 
    name: 'Rango', 
    enabled: true, 
    type: 'bridge',
    supportedChains: ['1', '56', '137', '42161', '10', '8453', '43114', '250', '324', '59144', '101', '784']
  },
  { 
    id: 'mexc', 
    name: 'MEXC', 
    enabled: true, 
    type: 'cex',
    supportedChains: ['1', '56', '137', '42161', '10', '8453', '43114']
  },
  { 
    id: 'changelly', 
    name: 'Changelly', 
    enabled: true, 
    type: 'cex',
    supportedChains: ['1', '56', '137', '42161', '10', '8453', '43114', '250', '101']
  },
  { 
    id: 'changenow', 
    name: 'ChangeNOW', 
    enabled: true, 
    type: 'cex',
    supportedChains: ['1', '56', '137', '42161', '10', '8453', '43114', '250']
  },
];

// Rango blockchain names
const RANGO_CHAINS: Record<string, string> = {
  '1': 'ETH',
  '56': 'BSC',
  '137': 'POLYGON',
  '42161': 'ARBITRUM',
  '10': 'OPTIMISM',
  '8453': 'BASE',
  '43114': 'AVAX_CCHAIN',
  '250': 'FANTOM',
  '101': 'SOLANA',
  '784': 'SUI',
};

// ============================================================================
// Helper Functions
// ============================================================================

const getChainId = (chain: Chain): string => {
  if (!chain) return '1';
  // Handle different chain id formats
  if (typeof chain.id === 'number') return chain.id.toString();
  if (typeof chain.id === 'string') return chain.id;
  if (chain.chainId) return chain.chainId.toString();
  return '1';
};

const getTokenAddress = (token: Token): string => {
  if (!token) return '0x0000000000000000000000000000000000000000';
  if (!token.address) return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  if (token.address === 'native' || token.isNative) return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  return token.address;
};

// ============================================================================
// Quote Service Class
// ============================================================================

class QuoteService {
  private lastQuotes: Quote[] = [];

  /**
   * Get quotes from all applicable providers
   */
  async getQuotes(request: QuoteRequest): Promise<Quote[]> {
    const { inputToken, outputToken, inputChain, outputChain, inputAmount, slippage = 1 } = request;

    if (!inputToken || !outputToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      throw new Error('Invalid quote request');
    }

    if (!inputChain || !outputChain) {
      throw new Error('Chain information is required');
    }

    const fromChainId = getChainId(inputChain);
    const toChainId = getChainId(outputChain);
    const isCrossChain = fromChainId !== toChainId;

    console.log(`[QuoteService] Fetching quotes: ${inputAmount} ${inputToken.symbol} (${fromChainId}) -> ${outputToken.symbol} (${toChainId})`);

    // Get applicable providers
    const applicableProviders = PROVIDER_CONFIGS.filter(provider => {
      if (!provider.enabled) return false;
      
      const supportsFromChain = provider.supportedChains.includes(fromChainId);
      const supportsToChain = provider.supportedChains.includes(toChainId);
      
      // DEX only works same-chain
      if (provider.type === 'dex' && isCrossChain) {
        return false;
      }
      
      // DEX needs to support the chain
      if (provider.type === 'dex') {
        return supportsFromChain;
      }
      
      // Bridge/CEX can do cross-chain
      return supportsFromChain && supportsToChain;
    });

    console.log(`[QuoteService] Applicable providers:`, applicableProviders.map(p => p.id));

    // Fetch quotes in parallel with timeout
    const quotePromises = applicableProviders.map(provider => 
      this.fetchProviderQuote(provider, request, fromChainId, toChainId)
        .catch(error => {
          console.warn(`[QuoteService] ${provider.id} failed:`, error.message);
          return null;
        })
    );

    // Also get a price-based estimate as fallback
    const priceEstimatePromise = this.getPriceBasedQuote(request, fromChainId, toChainId).catch(() => null);

    const results = await Promise.all([...quotePromises, priceEstimatePromise]);
    
    // Filter out nulls and sort by output amount
    const validQuotes = results
      .filter((q): q is Quote => q !== null && q.outputAmount && parseFloat(q.outputAmount) > 0)
      .sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    // Mark best rate
    if (validQuotes.length > 0) {
      validQuotes[0].isBestRate = true;
    }

    this.lastQuotes = validQuotes;
    console.log(`[QuoteService] Got ${validQuotes.length} valid quotes`);

    return validQuotes;
  }

  /**
   * Get single best quote
   */
  async getBestQuote(request: QuoteRequest): Promise<Quote | null> {
    const quotes = await this.getQuotes(request);
    return quotes.length > 0 ? quotes[0] : null;
  }

  /**
   * Fetch quote from a specific provider
   */
  private async fetchProviderQuote(
    provider: ProviderConfig, 
    request: QuoteRequest,
    fromChainId: string,
    toChainId: string
  ): Promise<Quote | null> {
    const timeout = 15000; // 15 second timeout

    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const quotePromise = (async () => {
      switch (provider.id) {
        case 'lifi':
          return this.getLiFiQuote(request, fromChainId, toChainId);
        case '1inch':
          return this.get1inchQuote(request, fromChainId);
        case 'jupiter':
          return this.getJupiterQuote(request);
        case 'socket':
          return this.getSocketQuote(request, fromChainId, toChainId);
        case 'rango':
          return this.getRangoQuote(request, fromChainId, toChainId);
        case 'mexc':
          return this.getMexcQuote(request, fromChainId, toChainId);
        case 'changelly':
          return this.getChangellyQuote(request, fromChainId, toChainId);
        case 'changenow':
          return this.getChangeNowQuote(request, fromChainId, toChainId);
        default:
          return null;
      }
    })();

    return Promise.race([quotePromise, timeoutPromise]);
  }

  // ============================================================================
  // Provider-Specific Quote Methods
  // ============================================================================

  /**
   * LI.FI Quote (Cross-chain DEX aggregator)
   */
  private async getLiFiQuote(request: QuoteRequest, fromChainId: string, toChainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount, userAddress } = request;
      
      const fromAmount = this.toSmallestUnit(inputAmount, inputToken.decimals || 18);
      const fromTokenAddr = getTokenAddress(inputToken);
      const toTokenAddr = getTokenAddress(outputToken);

      const params = {
        fromChain: parseInt(fromChainId),
        toChain: parseInt(toChainId),
        fromToken: fromTokenAddr,
        toToken: toTokenAddr,
        fromAmount,
        fromAddress: userAddress || '0x0000000000000000000000000000000000000000',
        slippage: (request.slippage || 1) / 100,
      };

      console.log('[LI.FI] Fetching quote...', { fromChainId, toChainId });

      const response = await axios.get('https://li.quest/v1/quote', { 
        params,
        timeout: 12000,
      });

      if (!response.data?.estimate) {
        return null;
      }

      const estimate = response.data.estimate;
      const outputAmount = this.fromSmallestUnit(estimate.toAmount, outputToken.decimals || 18);

      return this.createQuote('lifi', 'LI.FI', request, outputAmount, {
        estimatedGas: estimate.gasCosts?.[0]?.amount,
        estimatedGasUsd: parseFloat(estimate.gasCosts?.[0]?.amountUSD || '0'),
        estimatedTimeSeconds: response.data.estimate?.executionDuration || 300,
        route: response.data.includedSteps?.map((step: any) => ({
          type: step.type === 'cross' ? 'bridge' : 'swap',
          protocol: step.toolDetails?.name || step.tool,
          fromToken: step.action?.fromToken?.symbol,
          toToken: step.action?.toToken?.symbol,
          fromChainId: step.action?.fromChainId?.toString(),
          toChainId: step.action?.toChainId?.toString(),
        })),
        metadata: response.data,
      });
    } catch (error: any) {
      console.warn('[LI.FI] Quote error:', error.message);
      return null;
    }
  }

  /**
   * 1inch Quote (EVM DEX aggregator)
   */
  private async get1inchQuote(request: QuoteRequest, chainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount } = request;
      
      const fromAmount = this.toSmallestUnit(inputAmount, inputToken.decimals || 18);
      const fromToken = getTokenAddress(inputToken);
      const toToken = getTokenAddress(outputToken);

      console.log('[1inch] Fetching quote...', { chainId });

      const response = await axios.get(
        `https://api.1inch.dev/swap/v6.0/${chainId}/quote`,
        {
          params: {
            src: fromToken,
            dst: toToken,
            amount: fromAmount,
          },
          headers: {
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ONEINCH_API_KEY || ''}`,
          },
          timeout: 10000,
        }
      );

      if (!response.data?.dstAmount) {
        return null;
      }

      const outputAmount = this.fromSmallestUnit(response.data.dstAmount, outputToken.decimals || 18);

      return this.createQuote('1inch', '1inch', request, outputAmount, {
        estimatedGas: response.data.gas?.toString(),
        estimatedTimeSeconds: 30,
        route: [{
          type: 'swap',
          protocol: '1inch',
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromChainId: chainId,
          toChainId: chainId,
        }],
        metadata: response.data,
      });
    } catch (error: any) {
      console.warn('[1inch] Quote error:', error.message);
      return null;
    }
  }

  /**
   * Jupiter Quote (Solana DEX aggregator)
   */
  private async getJupiterQuote(request: QuoteRequest): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount } = request;
      
      if (!inputToken.address || !outputToken.address) {
        return null;
      }

      const fromAmount = this.toSmallestUnit(inputAmount, inputToken.decimals || 9);

      console.log('[Jupiter] Fetching quote...');

      const response = await axios.get('https://quote-api.jup.ag/v6/quote', {
        params: {
          inputMint: inputToken.address,
          outputMint: outputToken.address,
          amount: fromAmount,
          slippageBps: Math.floor((request.slippage || 1) * 100),
        },
        timeout: 10000,
      });

      if (!response.data?.outAmount) {
        return null;
      }

      const outputAmount = this.fromSmallestUnit(response.data.outAmount, outputToken.decimals || 9);

      return this.createQuote('jupiter', 'Jupiter', request, outputAmount, {
        priceImpact: parseFloat(response.data.priceImpactPct || '0'),
        estimatedTimeSeconds: 30,
        route: response.data.routePlan?.map((step: any) => ({
          type: 'swap',
          protocol: step.swapInfo?.label || 'Jupiter',
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromChainId: '101',
          toChainId: '101',
        })),
        metadata: response.data,
      });
    } catch (error: any) {
      console.warn('[Jupiter] Quote error:', error.message);
      return null;
    }
  }

  /**
   * Socket (Bungee) Quote (Bridge aggregator)
   */
  private async getSocketQuote(request: QuoteRequest, fromChainId: string, toChainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount, userAddress } = request;

      const fromAmount = this.toSmallestUnit(inputAmount, inputToken.decimals || 18);
      const fromTokenAddr = getTokenAddress(inputToken);
      const toTokenAddr = getTokenAddress(outputToken);

      console.log('[Socket] Fetching quote...', { fromChainId, toChainId });

      const response = await axios.get('https://api.socket.tech/v2/quote', {
        params: {
          fromChainId: parseInt(fromChainId),
          toChainId: parseInt(toChainId),
          fromTokenAddress: fromTokenAddr,
          toTokenAddress: toTokenAddr,
          fromAmount,
          userAddress: userAddress || '0x0000000000000000000000000000000000000000',
          uniqueRoutesPerBridge: true,
          sort: 'output',
        },
        headers: {
          'API-KEY': process.env.EXPO_PUBLIC_SOCKET_API_KEY || '72a5b4b0-e727-48be-8aa1-5da9d62fe635', // Demo key
        },
        timeout: 12000,
      });

      if (!response.data?.success || !response.data?.result?.routes?.length) {
        return null;
      }

      const bestRoute = response.data.result.routes[0];
      const outputAmount = this.fromSmallestUnit(bestRoute.toAmount, outputToken.decimals || 18);

      return this.createQuote('socket', 'Socket', request, outputAmount, {
        estimatedGasUsd: bestRoute.totalGasFeesInUsd,
        estimatedTimeSeconds: bestRoute.serviceTime || 300,
        route: bestRoute.usedBridgeNames?.map((bridge: string) => ({
          type: 'bridge',
          protocol: bridge,
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromChainId,
          toChainId,
        })),
        metadata: bestRoute,
      });
    } catch (error: any) {
      console.warn('[Socket] Quote error:', error.message);
      return null;
    }
  }

  /**
   * Rango Quote (Multi-chain aggregator)
   */
  private async getRangoQuote(request: QuoteRequest, fromChainId: string, toChainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount } = request;

      const fromBlockchain = RANGO_CHAINS[fromChainId];
      const toBlockchain = RANGO_CHAINS[toChainId];

      if (!fromBlockchain || !toBlockchain) {
        return null;
      }

      const formatToken = (token: Token, blockchain: string) => {
        const addr = getTokenAddress(token);
        if (addr === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' || addr === '0x0000000000000000000000000000000000000000') {
          return `${blockchain}.${token.symbol}`;
        }
        return `${blockchain}.${token.symbol}--${token.address}`;
      };

      console.log('[Rango] Fetching quote...', { fromBlockchain, toBlockchain });

      const response = await axios.get('https://api.rango.exchange/routing/best', {
        params: {
          from: formatToken(inputToken, fromBlockchain),
          to: formatToken(outputToken, toBlockchain),
          amount: inputAmount,
          slippage: (request.slippage || 1).toString(),
        },
        headers: {
          'API-KEY': process.env.EXPO_PUBLIC_RANGO_API_KEY || '',
        },
        timeout: 15000,
      });

      if (response.data.resultType !== 'OK' || !response.data.route) {
        return null;
      }

      const route = response.data.route;
      const outputAmount = route.outputAmount;

      return this.createQuote('rango', 'Rango', request, outputAmount, {
        estimatedGasUsd: route.feeUsd,
        estimatedTimeSeconds: route.estimatedTimeInSeconds,
        route: route.path?.map((step: any) => ({
          type: step.swapperType === 'BRIDGE' ? 'bridge' : 'swap',
          protocol: step.swapper?.title,
          fromToken: step.from?.symbol,
          toToken: step.to?.symbol,
          fromChainId,
          toChainId,
        })),
        metadata: response.data,
      });
    } catch (error: any) {
      console.warn('[Rango] Quote error:', error.message);
      return null;
    }
  }

  /**
   * MEXC Quote (CEX-based pricing)
   */
  private async getMexcQuote(request: QuoteRequest, fromChainId: string, toChainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount } = request;

      console.log('[MEXC] Fetching quote...');

      // Get MEXC prices
      const [inputPrice, outputPrice] = await Promise.all([
        this.getMexcPrice(inputToken.symbol),
        this.getMexcPrice(outputToken.symbol),
      ]);

      if (!inputPrice || !outputPrice) {
        return null;
      }

      // Calculate output with 0.1% fee
      const inputValue = parseFloat(inputAmount) * inputPrice;
      const feeRate = 0.001;
      const outputAmount = ((inputValue * (1 - feeRate)) / outputPrice).toFixed(8);

      return this.createQuote('mexc', 'MEXC', request, outputAmount, {
        estimatedTimeSeconds: 300,
        route: [{
          type: 'cex',
          protocol: 'MEXC',
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromChainId,
          toChainId,
        }],
      });
    } catch (error: any) {
      console.warn('[MEXC] Quote error:', error.message);
      return null;
    }
  }

  /**
   * Changelly Quote (CEX aggregator)
   */
  private async getChangellyQuote(request: QuoteRequest, fromChainId: string, toChainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount } = request;

      console.log('[Changelly] Fetching quote...');

      // Use price-based estimate (Changelly requires API auth)
      const [inputPrice, outputPrice] = await Promise.all([
        priceService.getPrice(inputToken, request.inputChain),
        priceService.getPrice(outputToken, request.outputChain),
      ]);

      if (!inputPrice || !outputPrice) {
        return null;
      }

      const inputValue = parseFloat(inputAmount) * inputPrice;
      const feeRate = 0.0025; // 0.25%
      const outputAmount = ((inputValue * (1 - feeRate)) / outputPrice).toFixed(8);

      return this.createQuote('changelly', 'Changelly', request, outputAmount, {
        estimatedTimeSeconds: 600,
        isEstimated: true,
        route: [{
          type: 'cex',
          protocol: 'Changelly',
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromChainId,
          toChainId,
        }],
      });
    } catch (error: any) {
      console.warn('[Changelly] Quote error:', error.message);
      return null;
    }
  }

  /**
   * ChangeNOW Quote (No-KYC exchange)
   */
  private async getChangeNowQuote(request: QuoteRequest, fromChainId: string, toChainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputAmount } = request;

      console.log('[ChangeNOW] Fetching quote...');

      const response = await axios.get('https://api.changenow.io/v2/exchange/estimated-amount', {
        params: {
          fromCurrency: inputToken.symbol.toLowerCase(),
          toCurrency: outputToken.symbol.toLowerCase(),
          fromAmount: inputAmount,
          flow: 'standard',
        },
        headers: {
          'x-changenow-api-key': process.env.EXPO_PUBLIC_CHANGENOW_API_KEY || '',
        },
        timeout: 10000,
      });

      if (!response.data?.toAmount) {
        return null;
      }

      return this.createQuote('changenow', 'ChangeNOW', request, response.data.toAmount.toString(), {
        estimatedTimeSeconds: this.parseTimeEstimate(response.data.transactionSpeedForecast),
        route: [{
          type: 'cex',
          protocol: 'ChangeNOW',
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromChainId,
          toChainId,
        }],
        metadata: response.data,
      });
    } catch (error: any) {
      console.warn('[ChangeNOW] Quote error:', error.message);
      return null;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get price-based quote as fallback
   */
  private async getPriceBasedQuote(request: QuoteRequest, fromChainId: string, toChainId: string): Promise<Quote | null> {
    try {
      const { inputToken, outputToken, inputChain, outputChain, inputAmount } = request;

      console.log('[Estimate] Getting price-based quote...');

      const [inputPrice, outputPrice] = await Promise.all([
        priceService.getPrice(inputToken, inputChain),
        priceService.getPrice(outputToken, outputChain),
      ]);

      if (!inputPrice || !outputPrice) {
        console.log('[Estimate] No prices available');
        return null;
      }

      const inputValue = parseFloat(inputAmount) * inputPrice;
      const outputAmount = (inputValue / outputPrice).toFixed(8);

      return this.createQuote('estimate', 'Estimated', request, outputAmount, {
        isEstimated: true,
        estimatedTimeSeconds: fromChainId === toChainId ? 30 : 300,
        route: [{
          type: fromChainId === toChainId ? 'swap' : 'bridge',
          protocol: 'Price Estimate',
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromChainId,
          toChainId,
        }],
      });
    } catch (error: any) {
      console.warn('[Estimate] Quote error:', error.message);
      return null;
    }
  }

  /**
   * Get MEXC price for a symbol
   */
  private async getMexcPrice(symbol: string): Promise<number | null> {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(upperSymbol)) {
        return 1;
      }

      const response = await axios.get(`https://api.mexc.com/api/v3/ticker/price`, {
        params: { symbol: `${upperSymbol}USDT` },
        timeout: 5000,
      });

      return parseFloat(response.data?.price) || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a standardized quote object
   */
  private createQuote(
    providerId: string,
    providerName: string,
    request: QuoteRequest,
    outputAmount: string,
    extra?: Partial<Quote>
  ): Quote {
    const { inputToken, outputToken, inputAmount } = request;
    
    const parsedOutput = parseFloat(outputAmount);
    const parsedInput = parseFloat(inputAmount);
    
    if (isNaN(parsedOutput) || parsedOutput <= 0) {
      throw new Error('Invalid output amount');
    }

    const exchangeRate = parsedOutput / parsedInput;

    return {
      id: `${providerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider: providerId,
      providerLogo: this.getProviderLogo(providerId),
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      outputAmountDisplay: this.formatAmount(outputAmount),
      outputAmountUsd: 0,
      exchangeRate,
      exchangeRateDisplay: `1 ${inputToken.symbol} = ${this.formatAmount(exchangeRate.toFixed(8))} ${outputToken.symbol}`,
      inputValueUsd: 0,
      outputValueUsd: 0,
      priceImpact: extra?.priceImpact || 0,
      isEstimated: extra?.isEstimated || false,
      ...extra,
    };
  }

  private getProviderLogo(providerId: string): string {
    const logos: Record<string, string> = {
      'lifi': '🔗',
      '1inch': '🦄',
      'jupiter': '🪐',
      'socket': '🔌',
      'rango': '🦎',
      'mexc': '🟡',
      'changelly': '💚',
      'changenow': '⚡',
      'estimate': '📊',
    };
    return logos[providerId] || '🔄';
  }

  private toSmallestUnit(amount: string, decimals: number): string {
    try {
      const [whole, fraction = ''] = amount.split('.');
      const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
      const result = (whole + paddedFraction).replace(/^0+/, '') || '0';
      return result;
    } catch {
      return '0';
    }
  }

  private fromSmallestUnit(amount: string, decimals: number): string {
    try {
      const amountStr = amount.toString();
      const padded = amountStr.padStart(decimals + 1, '0');
      const whole = padded.slice(0, -decimals) || '0';
      const fraction = padded.slice(-decimals);
      const result = `${whole}.${fraction}`.replace(/\.?0+$/, '') || '0';
      return result;
    } catch {
      return '0';
    }
  }

  private parseTimeEstimate(forecast?: string): number {
    if (!forecast) return 600;
    const match = forecast.match(/(\d+)/);
    return match ? parseInt(match[1]) * 60 : 600;
  }

  private formatAmount(amount: string): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    if (num === 0) return '0';
    if (num < 0.000001) return num.toExponential(4);
    if (num < 0.0001) return num.toFixed(6);
    if (num < 0.01) return num.toFixed(4);
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(4);
    if (num < 1000000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  /**
   * Get last fetched quotes
   */
  getLastQuotes(): Quote[] {
    return this.lastQuotes;
  }

  /**
   * Clear cached quotes
   */
  clearQuotes(): void {
    this.lastQuotes = [];
  }
}

export const quoteService = new QuoteService();
