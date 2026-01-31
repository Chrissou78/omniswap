import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { OneInchAdapter } from '../adapters/oneinch.adapter';
import { JupiterAdapter } from '../adapters/jupiter.adapter';
import { CetusAdapter } from '../adapters/cetus.adapter';
import { LiFiAdapter } from '../adapters/lifi.adapter';
import { PriceService } from './price.service';

// ============================================================================
// Types
// ============================================================================

export interface QuoteRequest {
  inputChainId: number;
  inputTokenAddress: string;
  outputChainId: number;
  outputTokenAddress: string;
  inputAmount: string;
  slippageBps?: number;
  userAddress?: string;
  userId?: string;
}

export interface SwapRoute {
  routeId: string;
  source: string;
  outputAmount: string;
  outputAmountUsd: number;
  inputAmountUsd: number;
  priceImpactBps: number;
  estimatedGas: string;
  estimatedGasUsd: number;
  estimatedTimeSeconds: number;
  steps: RouteStep[];
  tags: RouteTag[];
  routeData: any; // Raw data for execution
}

export interface RouteStep {
  type: 'swap' | 'bridge';
  protocol: string;
  protocolLogo?: string;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromChainId: number;
  toChainId: number;
  fromAmount: string;
  toAmount: string;
  estimatedTimeSeconds: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

export type RouteTag = 'BEST_RETURN' | 'FASTEST' | 'CHEAPEST';

export interface Quote {
  id: string;
  userId?: string;
  inputChainId: number;
  inputTokenAddress: string;
  inputTokenSymbol: string;
  inputAmount: string;
  inputAmountUsd: number;
  outputChainId: number;
  outputTokenAddress: string;
  outputTokenSymbol: string;
  routes: SwapRoute[];
  platformFeeBps: number;
  slippageBps: number;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================================================
// Quote Service
// ============================================================================

export class QuoteService {
  private redis: Redis;
  private priceService: PriceService;
  private oneInchAdapter: OneInchAdapter;
  private jupiterAdapter: JupiterAdapter;
  private cetusAdapter: CetusAdapter;
  private lifiAdapter: LiFiAdapter;

  private readonly QUOTE_CACHE_TTL = 30; // 30 seconds
  private readonly QUOTE_EXPIRY_MS = 60000; // 1 minute
  private readonly PLATFORM_FEE_BPS = 40; // 0.4%

  constructor(
    redis: Redis,
    priceService: PriceService,
    oneInchAdapter: OneInchAdapter,
    jupiterAdapter: JupiterAdapter,
    cetusAdapter: CetusAdapter,
    lifiAdapter: LiFiAdapter
  ) {
    this.redis = redis;
    this.priceService = priceService;
    this.oneInchAdapter = oneInchAdapter;
    this.jupiterAdapter = jupiterAdapter;
    this.cetusAdapter = cetusAdapter;
    this.lifiAdapter = lifiAdapter;
  }

  async getQuote(request: QuoteRequest): Promise<Quote> {
    const {
      inputChainId,
      inputTokenAddress,
      outputChainId,
      outputTokenAddress,
      inputAmount,
      slippageBps = 50,
      userAddress,
      userId,
    } = request;

    const quoteId = this.generateQuoteId();
    const isCrossChain = inputChainId !== outputChainId;

    logger.info('Getting quote', {
      quoteId,
      inputChainId,
      outputChainId,
      inputTokenAddress,
      outputTokenAddress,
      inputAmount,
      isCrossChain,
    });

    // Get token prices for USD calculations
    const [inputPrice, outputPrice] = await Promise.all([
      this.priceService.getTokenPrice(inputChainId, inputTokenAddress),
      this.priceService.getTokenPrice(outputChainId, outputTokenAddress),
    ]);

    const inputAmountUsd = parseFloat(inputAmount) * (inputPrice || 0);

    // Fetch routes from appropriate adapters
    let routes: SwapRoute[] = [];

    if (isCrossChain) {
      // Cross-chain: Use Li.Fi
      routes = await this.getCrossChainRoutes(request, inputPrice, outputPrice);
    } else {
      // Same-chain: Use chain-specific adapter
      routes = await this.getSameChainRoutes(request, inputPrice, outputPrice);
    }

    if (routes.length === 0) {
      throw new Error('No routes found for this swap');
    }

    // Sort and tag routes
    routes = this.rankAndTagRoutes(routes);

    // Get token symbols
    const [inputTokenInfo, outputTokenInfo] = await Promise.all([
      this.priceService.getTokenInfo(inputChainId, inputTokenAddress),
      this.priceService.getTokenInfo(outputChainId, outputTokenAddress),
    ]);

    const quote: Quote = {
      id: quoteId,
      userId,
      inputChainId,
      inputTokenAddress,
      inputTokenSymbol: inputTokenInfo?.symbol || 'UNKNOWN',
      inputAmount,
      inputAmountUsd,
      outputChainId,
      outputTokenAddress,
      outputTokenSymbol: outputTokenInfo?.symbol || 'UNKNOWN',
      routes,
      platformFeeBps: this.PLATFORM_FEE_BPS,
      slippageBps,
      expiresAt: new Date(Date.now() + this.QUOTE_EXPIRY_MS),
      createdAt: new Date(),
    };

    // Cache the quote
    await this.cacheQuote(quote);

    logger.info('Quote generated', {
      quoteId,
      routeCount: routes.length,
      bestOutput: routes[0]?.outputAmount,
    });

    return quote;
  }

  async getQuoteById(quoteId: string): Promise<Quote | null> {
    const cached = await this.redis.get(`quote:${quoteId}`);
    if (!cached) return null;

    const quote = JSON.parse(cached) as Quote;
    quote.expiresAt = new Date(quote.expiresAt);
    quote.createdAt = new Date(quote.createdAt);

    // Check if expired
    if (quote.expiresAt < new Date()) {
      await this.redis.del(`quote:${quoteId}`);
      return null;
    }

    return quote;
  }

  async refreshQuote(quoteId: string): Promise<Quote | null> {
    const existingQuote = await this.getQuoteById(quoteId);
    if (!existingQuote) return null;

    // Create new quote with same parameters
    return this.getQuote({
      inputChainId: existingQuote.inputChainId,
      inputTokenAddress: existingQuote.inputTokenAddress,
      outputChainId: existingQuote.outputChainId,
      outputTokenAddress: existingQuote.outputTokenAddress,
      inputAmount: existingQuote.inputAmount,
      slippageBps: existingQuote.slippageBps,
      userId: existingQuote.userId,
    });
  }

  // --------------------------------------------------------------------------
  // Same-Chain Routes
  // --------------------------------------------------------------------------

  private async getSameChainRoutes(
    request: QuoteRequest,
    inputPrice: number | null,
    outputPrice: number | null
  ): Promise<SwapRoute[]> {
    const { inputChainId, inputTokenAddress, outputTokenAddress, inputAmount, slippageBps, userAddress } = request;
    const routes: SwapRoute[] = [];

    // Determine which adapter to use based on chain
    if (inputChainId === 101) {
      // Solana - Use Jupiter
      const jupiterRoutes = await this.getJupiterRoutes(
        inputTokenAddress,
        outputTokenAddress,
        inputAmount,
        slippageBps || 50,
        inputPrice,
        outputPrice
      );
      routes.push(...jupiterRoutes);
    } else if (inputChainId === 784) {
      // Sui - Use Cetus
      const cetusRoutes = await this.getCetusRoutes(
        inputTokenAddress,
        outputTokenAddress,
        inputAmount,
        slippageBps || 50,
        inputPrice,
        outputPrice
      );
      routes.push(...cetusRoutes);
    } else {
      // EVM - Use 1inch
      const oneInchRoutes = await this.getOneInchRoutes(
        inputChainId,
        inputTokenAddress,
        outputTokenAddress,
        inputAmount,
        slippageBps || 50,
        userAddress,
        inputPrice,
        outputPrice
      );
      routes.push(...oneInchRoutes);
    }

    return routes;
  }

  private async getOneInchRoutes(
    chainId: number,
    fromToken: string,
    toToken: string,
    amount: string,
    slippageBps: number,
    userAddress?: string,
    inputPrice?: number | null,
    outputPrice?: number | null
  ): Promise<SwapRoute[]> {
    try {
      const quote = await this.oneInchAdapter.getQuote({
        chainId,
        fromTokenAddress: fromToken,
        toTokenAddress: toToken,
        amount,
        slippage: slippageBps / 100,
        fromAddress: userAddress,
      });

      if (!quote) return [];

      const outputAmountNum = parseFloat(quote.toAmount);
      const inputAmountNum = parseFloat(amount);

      return [{
        routeId: `1inch-${chainId}-${Date.now()}`,
        source: '1inch',
        outputAmount: quote.toAmount,
        outputAmountUsd: outputAmountNum * (outputPrice || 0),
        inputAmountUsd: inputAmountNum * (inputPrice || 0),
        priceImpactBps: quote.estimatedPriceImpact || 0,
        estimatedGas: quote.estimatedGas || '0',
        estimatedGasUsd: parseFloat(quote.estimatedGas || '0') * 0.00005, // Rough estimate
        estimatedTimeSeconds: 30,
        steps: [{
          type: 'swap',
          protocol: quote.protocols?.[0]?.[0]?.[0]?.name || '1inch',
          fromToken: {
            address: fromToken,
            symbol: quote.fromToken?.symbol || '',
            name: quote.fromToken?.name || '',
            decimals: quote.fromToken?.decimals || 18,
            chainId,
          },
          toToken: {
            address: toToken,
            symbol: quote.toToken?.symbol || '',
            name: quote.toToken?.name || '',
            decimals: quote.toToken?.decimals || 18,
            chainId,
          },
          fromChainId: chainId,
          toChainId: chainId,
          fromAmount: amount,
          toAmount: quote.toAmount,
          estimatedTimeSeconds: 30,
        }],
        tags: [],
        routeData: quote,
      }];
    } catch (error) {
      logger.error('1inch quote failed', { chainId, error });
      return [];
    }
  }

  private async getJupiterRoutes(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number,
    inputPrice?: number | null,
    outputPrice?: number | null
  ): Promise<SwapRoute[]> {
    try {
      const quote = await this.jupiterAdapter.getQuote({
        inputMint,
        outputMint,
        amount,
        slippageBps,
      });

      if (!quote || !quote.routePlan) return [];

      const outputAmountNum = parseFloat(quote.outAmount) / Math.pow(10, quote.outputDecimals || 9);
      const inputAmountNum = parseFloat(amount);

      const steps: RouteStep[] = quote.routePlan.map((step: any) => ({
        type: 'swap' as const,
        protocol: step.swapInfo?.label || 'Jupiter',
        fromToken: {
          address: step.swapInfo?.inputMint || inputMint,
          symbol: step.swapInfo?.inputSymbol || '',
          name: '',
          decimals: 9,
          chainId: 101,
        },
        toToken: {
          address: step.swapInfo?.outputMint || outputMint,
          symbol: step.swapInfo?.outputSymbol || '',
          name: '',
          decimals: 9,
          chainId: 101,
        },
        fromChainId: 101,
        toChainId: 101,
        fromAmount: step.swapInfo?.inAmount || amount,
        toAmount: step.swapInfo?.outAmount || quote.outAmount,
        estimatedTimeSeconds: 5,
      }));

      return [{
        routeId: `jupiter-${Date.now()}`,
        source: 'Jupiter',
        outputAmount: outputAmountNum.toString(),
        outputAmountUsd: outputAmountNum * (outputPrice || 0),
        inputAmountUsd: inputAmountNum * (inputPrice || 0),
        priceImpactBps: Math.round((quote.priceImpactPct || 0) * 100),
        estimatedGas: '5000', // Lamports
        estimatedGasUsd: 0.001,
        estimatedTimeSeconds: 15,
        steps,
        tags: [],
        routeData: quote,
      }];
    } catch (error) {
      logger.error('Jupiter quote failed', { error });
      return [];
    }
  }

  private async getCetusRoutes(
    inputCoin: string,
    outputCoin: string,
    amount: string,
    slippageBps: number,
    inputPrice?: number | null,
    outputPrice?: number | null
  ): Promise<SwapRoute[]> {
    try {
      const quote = await this.cetusAdapter.getQuote({
        inputCoin,
        outputCoin,
        amount,
        slippageBps,
      });

      if (!quote) return [];

      const outputAmountNum = parseFloat(quote.outputAmount);
      const inputAmountNum = parseFloat(amount);

      return [{
        routeId: `cetus-${Date.now()}`,
        source: 'Cetus',
        outputAmount: quote.outputAmount,
        outputAmountUsd: outputAmountNum * (outputPrice || 0),
        inputAmountUsd: inputAmountNum * (inputPrice || 0),
        priceImpactBps: quote.priceImpactBps || 0,
        estimatedGas: quote.estimatedGas || '0',
        estimatedGasUsd: 0.01,
        estimatedTimeSeconds: 10,
        steps: [{
          type: 'swap',
          protocol: 'Cetus',
          fromToken: {
            address: inputCoin,
            symbol: '',
            name: '',
            decimals: 9,
            chainId: 784,
          },
          toToken: {
            address: outputCoin,
            symbol: '',
            name: '',
            decimals: 9,
            chainId: 784,
          },
          fromChainId: 784,
          toChainId: 784,
          fromAmount: amount,
          toAmount: quote.outputAmount,
          estimatedTimeSeconds: 10,
        }],
        tags: [],
        routeData: quote,
      }];
    } catch (error) {
      logger.error('Cetus quote failed', { error });
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Cross-Chain Routes
  // --------------------------------------------------------------------------

  private async getCrossChainRoutes(
    request: QuoteRequest,
    inputPrice: number | null,
    outputPrice: number | null
  ): Promise<SwapRoute[]> {
    try {
      const lifiRoutes = await this.lifiAdapter.getRoutes({
        fromChainId: request.inputChainId,
        fromTokenAddress: request.inputTokenAddress,
        toChainId: request.outputChainId,
        toTokenAddress: request.outputTokenAddress,
        fromAmount: request.inputAmount,
        slippage: (request.slippageBps || 50) / 10000,
        fromAddress: request.userAddress,
      });

      return lifiRoutes.map((route: any, index: number) => {
        const outputAmountNum = parseFloat(route.toAmount);
        const inputAmountNum = parseFloat(request.inputAmount);

        const steps: RouteStep[] = route.steps?.map((step: any) => ({
          type: step.type === 'cross' ? 'bridge' : 'swap',
          protocol: step.toolDetails?.name || step.tool,
          protocolLogo: step.toolDetails?.logoURI,
          fromToken: {
            address: step.action?.fromToken?.address || '',
            symbol: step.action?.fromToken?.symbol || '',
            name: step.action?.fromToken?.name || '',
            decimals: step.action?.fromToken?.decimals || 18,
            chainId: step.action?.fromChainId,
          },
          toToken: {
            address: step.action?.toToken?.address || '',
            symbol: step.action?.toToken?.symbol || '',
            name: step.action?.toToken?.name || '',
            decimals: step.action?.toToken?.decimals || 18,
            chainId: step.action?.toChainId,
          },
          fromChainId: step.action?.fromChainId,
          toChainId: step.action?.toChainId,
          fromAmount: step.action?.fromAmount || '',
          toAmount: step.estimate?.toAmount || '',
          estimatedTimeSeconds: step.estimate?.executionDuration || 60,
        })) || [];

        return {
          routeId: `lifi-${index}-${Date.now()}`,
          source: 'Li.Fi',
          outputAmount: outputAmountNum.toString(),
          outputAmountUsd: outputAmountNum * (outputPrice || 0),
          inputAmountUsd: inputAmountNum * (inputPrice || 0),
          priceImpactBps: Math.round((route.tags?.includes('CHEAPEST') ? 10 : 25)),
          estimatedGas: route.gasCostUSD || '0',
          estimatedGasUsd: parseFloat(route.gasCostUSD || '0'),
          estimatedTimeSeconds: route.steps?.reduce(
            (acc: number, step: any) => acc + (step.estimate?.executionDuration || 60),
            0
          ) || 120,
          steps,
          tags: route.tags || [],
          routeData: route,
        };
      });
    } catch (error) {
      logger.error('Li.Fi routes failed', { error });
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private rankAndTagRoutes(routes: SwapRoute[]): SwapRoute[] {
    if (routes.length === 0) return routes;

    // Sort by output amount (best return first)
    routes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    // Find best for each category
    const bestReturn = routes[0];
    const fastest = routes.reduce((best, route) =>
      route.estimatedTimeSeconds < best.estimatedTimeSeconds ? route : best
    );
    const cheapest = routes.reduce((best, route) =>
      route.estimatedGasUsd < best.estimatedGasUsd ? route : best
    );

    // Tag routes
    routes.forEach(route => {
      route.tags = [];
      if (route.routeId === bestReturn.routeId) route.tags.push('BEST_RETURN');
      if (route.routeId === fastest.routeId) route.tags.push('FASTEST');
      if (route.routeId === cheapest.routeId) route.tags.push('CHEAPEST');
    });

    return routes;
  }

  private generateQuoteId(): string {
    return `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async cacheQuote(quote: Quote): Promise<void> {
    await this.redis.setex(
      `quote:${quote.id}`,
      this.QUOTE_CACHE_TTL,
      JSON.stringify(quote)
    );
  }
}
