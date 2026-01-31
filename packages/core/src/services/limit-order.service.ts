import { PrismaClient, LimitOrder, LimitOrderStatus, LimitOrderType, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { logger } from '../utils/logger';
import { PriceService } from './price.service';
import { QuoteService } from './quote.service';
import { SwapService } from './swap.service';

// ============================================================================
// Types
// ============================================================================

export interface CreateLimitOrderInput {
  userId: string;
  tenantId?: string;
  orderType: 'buy' | 'sell';
  inputTokenAddress: string;
  inputTokenSymbol: string;
  inputTokenDecimals: number;
  inputTokenLogoURI?: string;
  inputChainId: number;
  inputAmount: string;
  outputTokenAddress: string;
  outputTokenSymbol: string;
  outputTokenDecimals: number;
  outputTokenLogoURI?: string;
  outputChainId: number;
  targetPrice: string;
  slippageBps?: number;
  expiresIn?: number; // milliseconds
  partialFillAllowed?: boolean;
}

export interface UpdateLimitOrderInput {
  targetPrice?: string;
  slippageBps?: number;
  expiresAt?: Date;
  partialFillAllowed?: boolean;
}

export interface LimitOrderWithCurrentPrice extends LimitOrder {
  currentPrice: number;
  distancePercent: number;
}

export interface LimitOrderStats {
  totalOrders: number;
  pendingOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  totalVolume: number;
  totalFees: number;
}

export interface LimitOrderFilters {
  status?: LimitOrderStatus[];
  orderType?: LimitOrderType;
  chainId?: number;
  tokenAddress?: string;
}

// ============================================================================
// Limit Order Service
// ============================================================================

export class LimitOrderService {
  private prisma: PrismaClient;
  private redis: Redis;
  private priceService: PriceService;
  private quoteService: QuoteService;
  private swapService: SwapService;
  private orderCheckQueue: Queue;

  private readonly PRICE_CACHE_TTL = 10;
  private readonly STATS_CACHE_TTL = 60;
  private readonly DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
  private readonly DEFAULT_PLATFORM_FEE_BPS = 40; // 0.4%

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    priceService: PriceService,
    quoteService: QuoteService,
    swapService: SwapService,
    orderCheckQueue: Queue
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.priceService = priceService;
    this.quoteService = quoteService;
    this.swapService = swapService;
    this.orderCheckQueue = orderCheckQueue;
  }

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------

  async createOrder(input: CreateLimitOrderInput): Promise<LimitOrderWithCurrentPrice> {
    const {
      userId,
      tenantId,
      orderType,
      inputTokenAddress,
      inputTokenSymbol,
      inputTokenDecimals,
      inputTokenLogoURI,
      inputChainId,
      inputAmount,
      outputTokenAddress,
      outputTokenSymbol,
      outputTokenDecimals,
      outputTokenLogoURI,
      outputChainId,
      targetPrice,
      slippageBps = this.DEFAULT_SLIPPAGE_BPS,
      expiresIn,
      partialFillAllowed = false,
    } = input;

    // Get current market price
    const currentPrice = await this.getCurrentPrice(
      inputChainId,
      inputTokenAddress,
      outputChainId,
      outputTokenAddress
    );

    if (!currentPrice) {
      throw new Error('Unable to fetch current market price');
    }

    // Validate target price makes sense
    const targetPriceNum = parseFloat(targetPrice);
    if (orderType === 'buy' && targetPriceNum >= currentPrice) {
      throw new Error('Buy order target price must be below current market price');
    }
    if (orderType === 'sell' && targetPriceNum <= currentPrice) {
      throw new Error('Sell order target price must be above current market price');
    }

    // Calculate expiration
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : null;

    // Estimate output amount at target price
    const inputAmountNum = parseFloat(inputAmount);
    const estimatedOutput = inputAmountNum / targetPriceNum;

    // Get tenant fee config or use default
    let platformFeeBps = this.DEFAULT_PLATFORM_FEE_BPS;
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { feeConfig: true },
      });
      if (tenant?.feeConfig) {
        const feeConfig = tenant.feeConfig as { limitOrderFeeBps?: number };
        platformFeeBps = feeConfig.limitOrderFeeBps ?? this.DEFAULT_PLATFORM_FEE_BPS;
      }
    }

    // Create the order
    const order = await this.prisma.limitOrder.create({
      data: {
        userId,
        tenantId,
        orderType: orderType === 'buy' ? LimitOrderType.BUY : LimitOrderType.SELL,
        status: LimitOrderStatus.PENDING,
        inputTokenAddress: inputTokenAddress.toLowerCase(),
        inputTokenSymbol,
        inputTokenDecimals,
        inputTokenLogoURI,
        inputChainId,
        inputAmount: new Prisma.Decimal(inputAmount),
        outputTokenAddress: outputTokenAddress.toLowerCase(),
        outputTokenSymbol,
        outputTokenDecimals,
        outputTokenLogoURI,
        outputChainId,
        outputAmount: new Prisma.Decimal(estimatedOutput),
        targetPrice: new Prisma.Decimal(targetPrice),
        currentPrice: new Prisma.Decimal(currentPrice),
        priceAtCreation: new Prisma.Decimal(currentPrice),
        slippageBps,
        expiresAt,
        partialFillAllowed,
        platformFeeBps,
      },
    });

    // Invalidate stats cache
    await this.invalidateStatsCache(userId);

    // Schedule order check
    await this.orderCheckQueue.add(
      'check-order',
      { orderId: order.id },
      { delay: 5000 }
    );

    logger.info('Limit order created', {
      orderId: order.id,
      userId,
      orderType,
      inputTokenSymbol,
      outputTokenSymbol,
      targetPrice,
    });

    return this.enrichOrderWithPrice(order);
  }

  async updateOrder(
    orderId: string,
    userId: string,
    input: UpdateLimitOrderInput
  ): Promise<LimitOrderWithCurrentPrice> {
    // Verify ownership and status
    const existing = await this.prisma.limitOrder.findFirst({
      where: {
        id: orderId,
        userId,
        status: LimitOrderStatus.PENDING,
      },
    });

    if (!existing) {
      throw new Error('Order not found or cannot be modified');
    }

    const updateData: Prisma.LimitOrderUpdateInput = {};

    if (input.targetPrice !== undefined) {
      updateData.targetPrice = new Prisma.Decimal(input.targetPrice);
    }
    if (input.slippageBps !== undefined) {
      updateData.slippageBps = input.slippageBps;
    }
    if (input.expiresAt !== undefined) {
      updateData.expiresAt = input.expiresAt;
    }
    if (input.partialFillAllowed !== undefined) {
      updateData.partialFillAllowed = input.partialFillAllowed;
    }

    const order = await this.prisma.limitOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    logger.info('Limit order updated', { orderId, userId });

    return this.enrichOrderWithPrice(order);
  }

  async cancelOrder(orderId: string, userId: string): Promise<LimitOrder> {
    const existing = await this.prisma.limitOrder.findFirst({
      where: {
        id: orderId,
        userId,
        status: { in: [LimitOrderStatus.PENDING, LimitOrderStatus.PARTIALLY_FILLED] },
      },
    });

    if (!existing) {
      throw new Error('Order not found or cannot be cancelled');
    }

    const order = await this.prisma.limitOrder.update({
      where: { id: orderId },
      data: {
        status: LimitOrderStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await this.invalidateStatsCache(userId);

    logger.info('Limit order cancelled', { orderId, userId });

    return order;
  }

  async getOrder(orderId: string, userId: string): Promise<LimitOrderWithCurrentPrice | null> {
    const order = await this.prisma.limitOrder.findFirst({
      where: { id: orderId, userId },
      include: { fills: true },
    });

    if (!order) return null;

    return this.enrichOrderWithPrice(order);
  }

  async getUserOrders(
    userId: string,
    filters?: LimitOrderFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ orders: LimitOrderWithCurrentPrice[]; total: number }> {
    const where: Prisma.LimitOrderWhereInput = { userId };

    if (filters?.status?.length) {
      where.status = { in: filters.status };
    }
    if (filters?.orderType) {
      where.orderType = filters.orderType;
    }
    if (filters?.chainId) {
      where.OR = [
        { inputChainId: filters.chainId },
        { outputChainId: filters.chainId },
      ];
    }
    if (filters?.tokenAddress) {
      const addr = filters.tokenAddress.toLowerCase();
      where.OR = [
        { inputTokenAddress: addr },
        { outputTokenAddress: addr },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.limitOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { fills: true },
      }),
      this.prisma.limitOrder.count({ where }),
    ]);

    const enrichedOrders = await Promise.all(
      orders.map((order) => this.enrichOrderWithPrice(order))
    );

    return { orders: enrichedOrders, total };
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  async getOrderStats(userId: string): Promise<LimitOrderStats> {
    const cacheKey = `limitorder:stats:${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const [totalOrders, pendingOrders, filledOrders, cancelledOrders, volumeAndFees] =
      await Promise.all([
        this.prisma.limitOrder.count({ where: { userId } }),
        this.prisma.limitOrder.count({
          where: { userId, status: LimitOrderStatus.PENDING },
        }),
        this.prisma.limitOrder.count({
          where: { userId, status: LimitOrderStatus.FILLED },
        }),
        this.prisma.limitOrder.count({
          where: { userId, status: LimitOrderStatus.CANCELLED },
        }),
        this.prisma.limitOrder.aggregate({
          where: { userId, status: LimitOrderStatus.FILLED },
          _sum: {
            inputAmount: true,
            platformFeeAmount: true,
          },
        }),
      ]);

    const stats: LimitOrderStats = {
      totalOrders,
      pendingOrders,
      filledOrders,
      cancelledOrders,
      totalVolume: Number(volumeAndFees._sum.inputAmount || 0),
      totalFees: Number(volumeAndFees._sum.platformFeeAmount || 0),
    };

    await this.redis.setex(cacheKey, this.STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  // --------------------------------------------------------------------------
  // Order Checking & Execution
  // --------------------------------------------------------------------------

  async checkOrder(orderId: string): Promise<{ executed: boolean; reason?: string }> {
    const order = await this.prisma.limitOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { executed: false, reason: 'Order not found' };
    }

    // Check if order is still valid
    if (order.status !== LimitOrderStatus.PENDING && 
        order.status !== LimitOrderStatus.PARTIALLY_FILLED) {
      return { executed: false, reason: 'Order not active' };
    }

    // Check expiration
    if (order.expiresAt && order.expiresAt < new Date()) {
      await this.prisma.limitOrder.update({
        where: { id: orderId },
        data: { status: LimitOrderStatus.EXPIRED },
      });
      await this.invalidateStatsCache(order.userId);
      return { executed: false, reason: 'Order expired' };
    }

    // Get current price
    const currentPrice = await this.getCurrentPrice(
      order.inputChainId,
      order.inputTokenAddress,
      order.outputChainId,
      order.outputTokenAddress
    );

    if (!currentPrice) {
      return { executed: false, reason: 'Unable to fetch price' };
    }

    // Update current price in order
    await this.prisma.limitOrder.update({
      where: { id: orderId },
      data: { currentPrice: new Prisma.Decimal(currentPrice) },
    });

    // Check if target price is reached
    const targetPrice = Number(order.targetPrice);
    const shouldExecute =
      (order.orderType === LimitOrderType.BUY && currentPrice <= targetPrice) ||
      (order.orderType === LimitOrderType.SELL && currentPrice >= targetPrice);

    if (shouldExecute) {
      try {
        await this.executeOrder(order, currentPrice);
        return { executed: true };
      } catch (error) {
        logger.error('Order execution failed', { orderId, error });
        return { executed: false, reason: (error as Error).message };
      }
    }

    return { executed: false, reason: 'Target price not reached' };
  }

  private async executeOrder(order: LimitOrder, executionPrice: number): Promise<void> {
    logger.info('Executing limit order', { orderId: order.id, executionPrice });

    try {
      // Get quote for the swap
      const quote = await this.quoteService.getQuote({
        inputChainId: order.inputChainId,
        inputTokenAddress: order.inputTokenAddress,
        outputChainId: order.outputChainId,
        outputTokenAddress: order.outputTokenAddress,
        inputAmount: order.inputAmount.toString(),
        slippageBps: order.slippageBps,
        userId: order.userId,
      });

      if (!quote || !quote.routes.length) {
        throw new Error('No route available for execution');
      }

      // Execute the swap
      const result = await this.swapService.executeSwap({
        userId: order.userId,
        quoteId: quote.id,
        routeIndex: 0, // Best route
      });

      // Calculate fees
      const inputAmountNum = Number(order.inputAmount);
      const platformFeeAmount = (inputAmountNum * order.platformFeeBps) / 10000;

      // Update order as filled
      await this.prisma.$transaction([
        this.prisma.limitOrder.update({
          where: { id: order.id },
          data: {
            status: LimitOrderStatus.FILLED,
            executionPrice: new Prisma.Decimal(executionPrice),
            outputAmount: new Prisma.Decimal(result.outputAmount),
            filledAmount: order.inputAmount,
            fillPercent: new Prisma.Decimal(100),
            platformFeeAmount: new Prisma.Decimal(platformFeeAmount),
            gasFeeActual: result.gasFee ? new Prisma.Decimal(result.gasFee) : null,
            txHash: result.txHash,
            blockNumber: result.blockNumber ? BigInt(result.blockNumber) : null,
            routeData: quote.routes[0],
            executedAt: new Date(),
          },
        }),
        this.prisma.limitOrderFill.create({
          data: {
            orderId: order.id,
            fillAmount: order.inputAmount,
            fillPrice: new Prisma.Decimal(executionPrice),
            outputAmount: new Prisma.Decimal(result.outputAmount),
            txHash: result.txHash,
            blockNumber: result.blockNumber ? BigInt(result.blockNumber) : 0n,
            gasUsed: result.gasFee ? new Prisma.Decimal(result.gasFee) : null,
          },
        }),
      ]);

      await this.invalidateStatsCache(order.userId);

      logger.info('Limit order executed successfully', {
        orderId: order.id,
        txHash: result.txHash,
        outputAmount: result.outputAmount,
      });
    } catch (error) {
      // Mark order as failed
      await this.prisma.limitOrder.update({
        where: { id: order.id },
        data: {
          status: LimitOrderStatus.FAILED,
          errorMessage: (error as Error).message,
        },
      });

      await this.invalidateStatsCache(order.userId);
      throw error;
    }
  }

  async checkAllPendingOrders(): Promise<{ checked: number; executed: number }> {
    const pendingOrders = await this.prisma.limitOrder.findMany({
      where: {
        status: { in: [LimitOrderStatus.PENDING, LimitOrderStatus.PARTIALLY_FILLED] },
      },
      select: { id: true },
    });

    let executed = 0;

    for (const order of pendingOrders) {
      const result = await this.checkOrder(order.id);
      if (result.executed) executed++;
    }

    logger.info('Limit order check completed', { checked: pendingOrders.length, executed });

    return { checked: pendingOrders.length, executed };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async getCurrentPrice(
    inputChainId: number,
    inputTokenAddress: string,
    outputChainId: number,
    outputTokenAddress: string
  ): Promise<number | null> {
    const cacheKey = `price:pair:${inputChainId}:${inputTokenAddress}:${outputChainId}:${outputTokenAddress}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return parseFloat(cached);
    }

    try {
      const [inputPrice, outputPrice] = await Promise.all([
        this.priceService.getTokenPrice(inputChainId, inputTokenAddress),
        this.priceService.getTokenPrice(outputChainId, outputTokenAddress),
      ]);

      if (!inputPrice || !outputPrice) return null;

      // Price = how much output token per 1 input token
      const price = inputPrice / outputPrice;

      await this.redis.setex(cacheKey, this.PRICE_CACHE_TTL, price.toString());

      return price;
    } catch (error) {
      logger.error('Failed to get current price', { error });
      return null;
    }
  }

  private async enrichOrderWithPrice(order: LimitOrder): Promise<LimitOrderWithCurrentPrice> {
    const currentPrice = await this.getCurrentPrice(
      order.inputChainId,
      order.inputTokenAddress,
      order.outputChainId,
      order.outputTokenAddress
    );

    const targetPrice = Number(order.targetPrice);
    const currentPriceNum = currentPrice || Number(order.currentPrice) || targetPrice;
    const distancePercent = ((currentPriceNum - targetPrice) / targetPrice) * 100;

    return {
      ...order,
      currentPrice: currentPriceNum,
      distancePercent,
    };
  }

  private async invalidateStatsCache(userId: string): Promise<void> {
    await this.redis.del(`limitorder:stats:${userId}`);
  }
}
