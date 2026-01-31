import {
  PrismaClient,
  DCAStrategy,
  DCAExecution,
  DCAStatus,
  DCAFrequency,
  DCAExecutionStatus,
  Prisma,
} from '@prisma/client';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { logger } from '../utils/logger';
import { PriceService } from './price.service';
import { QuoteService } from './quote.service';
import { SwapService } from './swap.service';
import { GasService } from './gas.service';

// ============================================================================
// Types
// ============================================================================

export interface CreateDCAInput {
  userId: string;
  tenantId?: string;
  name?: string;
  inputTokenAddress: string;
  inputTokenSymbol: string;
  inputTokenDecimals: number;
  inputTokenLogoURI?: string;
  inputChainId: number;
  outputTokenAddress: string;
  outputTokenSymbol: string;
  outputTokenDecimals: number;
  outputTokenLogoURI?: string;
  outputChainId: number;
  amountPerExecution: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  customIntervalMs?: number;
  totalExecutions: number;
  slippageBps?: number;
  maxPriceImpactBps?: number;
  skipOnHighGas?: boolean;
  maxGasUsd?: number;
}

export interface UpdateDCAInput {
  name?: string;
  slippageBps?: number;
  maxPriceImpactBps?: number;
  skipOnHighGas?: boolean;
  maxGasUsd?: number;
}

export interface DCAWithStats extends DCAStrategy {
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface DCAStats {
  totalStrategies: number;
  activeStrategies: number;
  completedStrategies: number;
  totalInvested: number;
  totalReceived: number;
  totalFees: number;
}

export interface DCAAnalytics {
  executionHistory: {
    date: string;
    inputAmount: number;
    outputAmount: number;
    price: number;
  }[];
  averagePrice: number;
  currentPrice: number;
  performancePercent: number;
}

// ============================================================================
// Constants
// ============================================================================

const FREQUENCY_MS: Record<DCAFrequency, number> = {
  HOURLY: 60 * 60 * 1000, // 1 hour
  DAILY: 24 * 60 * 60 * 1000, // 24 hours
  WEEKLY: 7 * 24 * 60 * 60 * 1000, // 7 days
  BIWEEKLY: 14 * 24 * 60 * 60 * 1000, // 14 days
  MONTHLY: 30 * 24 * 60 * 60 * 1000, // 30 days
  CUSTOM: 0,
};

// ============================================================================
// DCA Service
// ============================================================================

export class DCAService {
  private prisma: PrismaClient;
  private redis: Redis;
  private priceService: PriceService;
  private quoteService: QuoteService;
  private swapService: SwapService;
  private gasService: GasService;
  private dcaExecutionQueue: Queue;

  private readonly DEFAULT_SLIPPAGE_BPS = 100; // 1%
  private readonly DEFAULT_MAX_PRICE_IMPACT_BPS = 300; // 3%
  private readonly DEFAULT_PLATFORM_FEE_BPS = 40; // 0.4%
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly STATS_CACHE_TTL = 60;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    priceService: PriceService,
    quoteService: QuoteService,
    swapService: SwapService,
    gasService: GasService,
    dcaExecutionQueue: Queue
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.priceService = priceService;
    this.quoteService = quoteService;
    this.swapService = swapService;
    this.gasService = gasService;
    this.dcaExecutionQueue = dcaExecutionQueue;
  }

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------

  async createStrategy(input: CreateDCAInput): Promise<DCAWithStats> {
    const {
      userId,
      tenantId,
      name,
      inputTokenAddress,
      inputTokenSymbol,
      inputTokenDecimals,
      inputTokenLogoURI,
      inputChainId,
      outputTokenAddress,
      outputTokenSymbol,
      outputTokenDecimals,
      outputTokenLogoURI,
      outputChainId,
      amountPerExecution,
      frequency,
      customIntervalMs,
      totalExecutions,
      slippageBps = this.DEFAULT_SLIPPAGE_BPS,
      maxPriceImpactBps = this.DEFAULT_MAX_PRICE_IMPACT_BPS,
      skipOnHighGas = false,
      maxGasUsd,
    } = input;

    // Validate frequency
    const dcaFrequency = this.mapFrequency(frequency);
    if (dcaFrequency === DCAFrequency.CUSTOM && !customIntervalMs) {
      throw new Error('customIntervalMs required for custom frequency');
    }

    // Validate total executions
    if (totalExecutions < 2 || totalExecutions > 365) {
      throw new Error('totalExecutions must be between 2 and 365');
    }

    // Calculate first execution time
    const intervalMs = dcaFrequency === DCAFrequency.CUSTOM
      ? customIntervalMs!
      : FREQUENCY_MS[dcaFrequency];
    const nextExecutionAt = new Date(Date.now() + intervalMs);

    // Get tenant fee config
    let platformFeeBps = this.DEFAULT_PLATFORM_FEE_BPS;
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { feeConfig: true },
      });
      if (tenant?.feeConfig) {
        const feeConfig = tenant.feeConfig as { dcaFeeBps?: number };
        platformFeeBps = feeConfig.dcaFeeBps ?? this.DEFAULT_PLATFORM_FEE_BPS;
      }
    }

    // Create strategy
    const strategy = await this.prisma.dCAStrategy.create({
      data: {
        userId,
        tenantId,
        name: name || `DCA ${inputTokenSymbol} → ${outputTokenSymbol}`,
        status: DCAStatus.ACTIVE,
        inputTokenAddress: inputTokenAddress.toLowerCase(),
        inputTokenSymbol,
        inputTokenDecimals,
        inputTokenLogoURI,
        inputChainId,
        outputTokenAddress: outputTokenAddress.toLowerCase(),
        outputTokenSymbol,
        outputTokenDecimals,
        outputTokenLogoURI,
        outputChainId,
        amountPerExecution: new Prisma.Decimal(amountPerExecution),
        frequency: dcaFrequency,
        customIntervalMs: customIntervalMs ? BigInt(customIntervalMs) : null,
        totalExecutions,
        nextExecutionAt,
        slippageBps,
        maxPriceImpactBps,
        skipOnHighGas,
        maxGasUsd: maxGasUsd ? new Prisma.Decimal(maxGasUsd) : null,
        platformFeeBps,
      },
    });

    // Schedule first execution
    await this.scheduleExecution(strategy.id, nextExecutionAt, 1);

    await this.invalidateStatsCache(userId);

    logger.info('DCA strategy created', {
      strategyId: strategy.id,
      userId,
      inputToken: inputTokenSymbol,
      outputToken: outputTokenSymbol,
      frequency,
      totalExecutions,
    });

    return this.enrichStrategyWithStats(strategy);
  }

  async updateStrategy(
    strategyId: string,
    userId: string,
    input: UpdateDCAInput
  ): Promise<DCAWithStats> {
    const existing = await this.prisma.dCAStrategy.findFirst({
      where: {
        id: strategyId,
        userId,
        status: { in: [DCAStatus.ACTIVE, DCAStatus.PAUSED] },
      },
    });

    if (!existing) {
      throw new Error('Strategy not found or cannot be modified');
    }

    const updateData: Prisma.DCAStrategyUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.slippageBps !== undefined) updateData.slippageBps = input.slippageBps;
    if (input.maxPriceImpactBps !== undefined) updateData.maxPriceImpactBps = input.maxPriceImpactBps;
    if (input.skipOnHighGas !== undefined) updateData.skipOnHighGas = input.skipOnHighGas;
    if (input.maxGasUsd !== undefined) {
      updateData.maxGasUsd = input.maxGasUsd ? new Prisma.Decimal(input.maxGasUsd) : null;
    }

    const strategy = await this.prisma.dCAStrategy.update({
      where: { id: strategyId },
      data: updateData,
    });

    logger.info('DCA strategy updated', { strategyId, userId });

    return this.enrichStrategyWithStats(strategy);
  }

  async pauseStrategy(strategyId: string, userId: string): Promise<DCAStrategy> {
    const existing = await this.prisma.dCAStrategy.findFirst({
      where: {
        id: strategyId,
        userId,
        status: DCAStatus.ACTIVE,
      },
    });

    if (!existing) {
      throw new Error('Strategy not found or cannot be paused');
    }

    const strategy = await this.prisma.dCAStrategy.update({
      where: { id: strategyId },
      data: {
        status: DCAStatus.PAUSED,
        pausedAt: new Date(),
      },
    });

    await this.invalidateStatsCache(userId);

    logger.info('DCA strategy paused', { strategyId, userId });

    return strategy;
  }

  async resumeStrategy(strategyId: string, userId: string): Promise<DCAStrategy> {
    const existing = await this.prisma.dCAStrategy.findFirst({
      where: {
        id: strategyId,
        userId,
        status: DCAStatus.PAUSED,
      },
    });

    if (!existing) {
      throw new Error('Strategy not found or cannot be resumed');
    }

    // Calculate next execution
    const intervalMs = existing.frequency === DCAFrequency.CUSTOM
      ? Number(existing.customIntervalMs)
      : FREQUENCY_MS[existing.frequency];
    const nextExecutionAt = new Date(Date.now() + intervalMs);

    const strategy = await this.prisma.dCAStrategy.update({
      where: { id: strategyId },
      data: {
        status: DCAStatus.ACTIVE,
        pausedAt: null,
        nextExecutionAt,
        consecutiveFailures: 0,
        lastError: null,
      },
    });

    // Schedule next execution
    await this.scheduleExecution(
      strategyId,
      nextExecutionAt,
      existing.executionsCompleted + 1
    );

    await this.invalidateStatsCache(userId);

    logger.info('DCA strategy resumed', { strategyId, userId });

    return strategy;
  }

  async cancelStrategy(strategyId: string, userId: string): Promise<DCAStrategy> {
    const existing = await this.prisma.dCAStrategy.findFirst({
      where: {
        id: strategyId,
        userId,
        status: { in: [DCAStatus.ACTIVE, DCAStatus.PAUSED] },
      },
    });

    if (!existing) {
      throw new Error('Strategy not found or cannot be cancelled');
    }

    const strategy = await this.prisma.dCAStrategy.update({
      where: { id: strategyId },
      data: {
        status: DCAStatus.CANCELLED,
        cancelledAt: new Date(),
        nextExecutionAt: null,
      },
    });

    await this.invalidateStatsCache(userId);

    logger.info('DCA strategy cancelled', { strategyId, userId });

    return strategy;
  }

  async getStrategy(strategyId: string, userId: string): Promise<DCAWithStats | null> {
    const strategy = await this.prisma.dCAStrategy.findFirst({
      where: { id: strategyId, userId },
      include: {
        executions: {
          orderBy: { executionNumber: 'desc' },
          take: 10,
        },
      },
    });

    if (!strategy) return null;

    return this.enrichStrategyWithStats(strategy);
  }

  async getUserStrategies(
    userId: string,
    status?: DCAStatus[],
    limit: number = 50,
    offset: number = 0
  ): Promise<{ strategies: DCAWithStats[]; total: number }> {
    const where: Prisma.DCAStrategyWhereInput = { userId };
    if (status?.length) {
      where.status = { in: status };
    }

    const [strategies, total] = await Promise.all([
      this.prisma.dCAStrategy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          executions: {
            orderBy: { executionNumber: 'desc' },
            take: 5,
          },
        },
      }),
      this.prisma.dCAStrategy.count({ where }),
    ]);

    const enrichedStrategies = await Promise.all(
      strategies.map((s) => this.enrichStrategyWithStats(s))
    );

    return { strategies: enrichedStrategies, total };
  }

  // --------------------------------------------------------------------------
  // Stats & Analytics
  // --------------------------------------------------------------------------

  async getStats(userId: string): Promise<DCAStats> {
    const cacheKey = `dca:stats:${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const [
      totalStrategies,
      activeStrategies,
      completedStrategies,
      aggregates,
    ] = await Promise.all([
      this.prisma.dCAStrategy.count({ where: { userId } }),
      this.prisma.dCAStrategy.count({ where: { userId, status: DCAStatus.ACTIVE } }),
      this.prisma.dCAStrategy.count({ where: { userId, status: DCAStatus.COMPLETED } }),
      this.prisma.dCAStrategy.aggregate({
        where: { userId },
        _sum: {
          totalInputSpent: true,
          totalOutputReceived: true,
          totalPlatformFees: true,
          totalGasFees: true,
        },
      }),
    ]);

    const stats: DCAStats = {
      totalStrategies,
      activeStrategies,
      completedStrategies,
      totalInvested: Number(aggregates._sum.totalInputSpent || 0),
      totalReceived: Number(aggregates._sum.totalOutputReceived || 0),
      totalFees: Number(aggregates._sum.totalPlatformFees || 0) + 
                 Number(aggregates._sum.totalGasFees || 0),
    };

    await this.redis.setex(cacheKey, this.STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  async getStrategyAnalytics(strategyId: string, userId: string): Promise<DCAAnalytics | null> {
    const strategy = await this.prisma.dCAStrategy.findFirst({
      where: { id: strategyId, userId },
      include: {
        executions: {
          where: { status: DCAExecutionStatus.COMPLETED },
          orderBy: { completedAt: 'asc' },
        },
      },
    });

    if (!strategy) return null;

    const executionHistory = strategy.executions.map((exec) => ({
      date: exec.completedAt!.toISOString().split('T')[0],
      inputAmount: Number(exec.inputAmount),
      outputAmount: Number(exec.outputAmount || 0),
      price: Number(exec.executionPrice || 0),
    }));

    const currentPrice = await this.getCurrentPrice(strategy);
    const averagePrice = Number(strategy.averagePrice || 0);
    const performancePercent = averagePrice > 0
      ? ((currentPrice - averagePrice) / averagePrice) * 100
      : 0;

    return {
      executionHistory,
      averagePrice,
      currentPrice,
      performancePercent,
    };
  }

  async getExecutions(
    strategyId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ executions: DCAExecution[]; total: number }> {
    // Verify ownership
    const strategy = await this.prisma.dCAStrategy.findFirst({
      where: { id: strategyId, userId },
      select: { id: true },
    });

    if (!strategy) {
      throw new Error('Strategy not found');
    }

    const [executions, total] = await Promise.all([
      this.prisma.dCAExecution.findMany({
        where: { strategyId },
        orderBy: { executionNumber: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.dCAExecution.count({ where: { strategyId } }),
    ]);

    return { executions, total };
  }

  // --------------------------------------------------------------------------
  // Execution Logic
  // --------------------------------------------------------------------------

  async executeStrategy(strategyId: string, executionNumber: number): Promise<void> {
    const strategy = await this.prisma.dCAStrategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      logger.warn('Strategy not found for execution', { strategyId });
      return;
    }

    if (strategy.status !== DCAStatus.ACTIVE) {
      logger.info('Strategy not active, skipping execution', { strategyId, status: strategy.status });
      return;
    }

    // Create execution record
    const execution = await this.prisma.dCAExecution.create({
      data: {
        strategyId,
        executionNumber,
        status: DCAExecutionStatus.PENDING,
        inputAmount: strategy.amountPerExecution,
        scheduledAt: new Date(),
      },
    });

    try {
      // Update execution status
      await this.prisma.dCAExecution.update({
        where: { id: execution.id },
        data: {
          status: DCAExecutionStatus.EXECUTING,
          startedAt: new Date(),
        },
      });

      // Check gas price if configured
      if (strategy.skipOnHighGas && strategy.maxGasUsd) {
        const currentGasUsd = await this.gasService.getGasPriceUsd(strategy.inputChainId);
        if (currentGasUsd > Number(strategy.maxGasUsd)) {
          await this.handleSkippedExecution(strategy, execution, 'Gas price too high');
          return;
        }
      }

      // Get quote
      const quote = await this.quoteService.getQuote({
        inputChainId: strategy.inputChainId,
        inputTokenAddress: strategy.inputTokenAddress,
        outputChainId: strategy.outputChainId,
        outputTokenAddress: strategy.outputTokenAddress,
        inputAmount: strategy.amountPerExecution.toString(),
        slippageBps: strategy.slippageBps,
        userId: strategy.userId,
      });

      if (!quote || !quote.routes.length) {
        throw new Error('No route available');
      }

      const bestRoute = quote.routes[0];

      // Check price impact
      if (bestRoute.priceImpactBps && bestRoute.priceImpactBps > strategy.maxPriceImpactBps) {
        await this.handleSkippedExecution(
          strategy,
          execution,
          `Price impact too high: ${bestRoute.priceImpactBps / 100}%`
        );
        return;
      }

      // Execute swap
      const result = await this.swapService.executeSwap({
        userId: strategy.userId,
        quoteId: quote.id,
        routeIndex: 0,
      });

      // Calculate fees
      const inputAmountNum = Number(strategy.amountPerExecution);
      const platformFeeAmount = (inputAmountNum * strategy.platformFeeBps) / 10000;
      const executionPrice = inputAmountNum / parseFloat(result.outputAmount);

      // Update execution as completed
      await this.prisma.dCAExecution.update({
        where: { id: execution.id },
        data: {
          status: DCAExecutionStatus.COMPLETED,
          outputAmount: new Prisma.Decimal(result.outputAmount),
          executionPrice: new Prisma.Decimal(executionPrice),
          priceImpactBps: bestRoute.priceImpactBps,
          platformFeeAmount: new Prisma.Decimal(platformFeeAmount),
          gasFeeAmount: result.gasFee ? new Prisma.Decimal(result.gasFee) : null,
          txHash: result.txHash,
          blockNumber: result.blockNumber ? BigInt(result.blockNumber) : null,
          routeData: bestRoute,
          completedAt: new Date(),
        },
      });

      // Update strategy stats
      const newTotalInput = Number(strategy.totalInputSpent) + inputAmountNum;
      const newTotalOutput = Number(strategy.totalOutputReceived) + parseFloat(result.outputAmount);
      const newAveragePrice = newTotalInput / newTotalOutput;
      const isCompleted = executionNumber >= strategy.totalExecutions;

      await this.prisma.dCAStrategy.update({
        where: { id: strategyId },
        data: {
          executionsCompleted: { increment: 1 },
          totalInputSpent: new Prisma.Decimal(newTotalInput),
          totalOutputReceived: new Prisma.Decimal(newTotalOutput),
          averagePrice: new Prisma.Decimal(newAveragePrice),
          totalPlatformFees: { increment: new Prisma.Decimal(platformFeeAmount) },
          totalGasFees: result.gasFee
            ? { increment: new Prisma.Decimal(result.gasFee) }
            : undefined,
          consecutiveFailures: 0,
          lastError: null,
          status: isCompleted ? DCAStatus.COMPLETED : undefined,
          completedAt: isCompleted ? new Date() : undefined,
          nextExecutionAt: isCompleted ? null : undefined,
        },
      });

      // Schedule next execution if not completed
      if (!isCompleted) {
        await this.scheduleNextExecution(strategy, executionNumber + 1);
      }

      await this.invalidateStatsCache(strategy.userId);

      logger.info('DCA execution completed', {
        strategyId,
        executionNumber,
        outputAmount: result.outputAmount,
        txHash: result.txHash,
      });
    } catch (error) {
      await this.handleFailedExecution(strategy, execution, error as Error);
    }
  }

  private async handleSkippedExecution(
    strategy: DCAStrategy,
    execution: DCAExecution,
    reason: string
  ): Promise<void> {
    await this.prisma.dCAExecution.update({
      where: { id: execution.id },
      data: {
        status: DCAExecutionStatus.SKIPPED,
        errorMessage: reason,
        completedAt: new Date(),
      },
    });

    // Schedule retry with same execution number
    await this.scheduleNextExecution(strategy, execution.executionNumber);

    logger.info('DCA execution skipped', {
      strategyId: strategy.id,
      executionNumber: execution.executionNumber,
      reason,
    });
  }

  private async handleFailedExecution(
    strategy: DCAStrategy,
    execution: DCAExecution,
    error: Error
  ): Promise<void> {
    await this.prisma.dCAExecution.update({
      where: { id: execution.id },
      data: {
        status: DCAExecutionStatus.FAILED,
        errorMessage: error.message,
        completedAt: new Date(),
      },
    });

    const newFailureCount = strategy.consecutiveFailures + 1;
    const shouldPause = newFailureCount >= this.MAX_CONSECUTIVE_FAILURES;

    await this.prisma.dCAStrategy.update({
      where: { id: strategy.id },
      data: {
        consecutiveFailures: newFailureCount,
        lastError: error.message,
        status: shouldPause ? DCAStatus.FAILED : undefined,
      },
    });

    if (!shouldPause) {
      // Retry with exponential backoff
      const backoffMs = Math.min(60000 * Math.pow(2, newFailureCount - 1), 3600000); // Max 1 hour
      const retryAt = new Date(Date.now() + backoffMs);
      await this.scheduleExecution(strategy.id, retryAt, execution.executionNumber);
    }

    await this.invalidateStatsCache(strategy.userId);

    logger.error('DCA execution failed', {
      strategyId: strategy.id,
      executionNumber: execution.executionNumber,
      error: error.message,
      consecutiveFailures: newFailureCount,
      paused: shouldPause,
    });
  }

  private async scheduleNextExecution(
    strategy: DCAStrategy,
    nextExecutionNumber: number
  ): Promise<void> {
    const intervalMs = strategy.frequency === DCAFrequency.CUSTOM
      ? Number(strategy.customIntervalMs)
      : FREQUENCY_MS[strategy.frequency];

    const nextExecutionAt = new Date(Date.now() + intervalMs);

    await this.prisma.dCAStrategy.update({
      where: { id: strategy.id },
      data: { nextExecutionAt },
    });

    await this.scheduleExecution(strategy.id, nextExecutionAt, nextExecutionNumber);
  }

  private async scheduleExecution(
    strategyId: string,
    executionAt: Date,
    executionNumber: number
  ): Promise<void> {
    const delay = Math.max(0, executionAt.getTime() - Date.now());

    await this.dcaExecutionQueue.add(
      'execute-dca',
      { strategyId, executionNumber },
      {
        delay,
        jobId: `dca-${strategyId}-${executionNumber}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async enrichStrategyWithStats(strategy: DCAStrategy): Promise<DCAWithStats> {
    const currentPrice = await this.getCurrentPrice(strategy);
    const averagePrice = Number(strategy.averagePrice || 0);
    const totalOutputReceived = Number(strategy.totalOutputReceived || 0);

    let unrealizedPnL = 0;
    let unrealizedPnLPercent = 0;

    if (averagePrice > 0 && totalOutputReceived > 0) {
      const currentValue = totalOutputReceived * currentPrice;
      const costBasis = Number(strategy.totalInputSpent);
      unrealizedPnL = currentValue - costBasis;
      unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;
    }

    return {
      ...strategy,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
    };
  }

  private async getCurrentPrice(strategy: DCAStrategy): Promise<number> {
    const cacheKey = `price:pair:${strategy.inputChainId}:${strategy.inputTokenAddress}:${strategy.outputChainId}:${strategy.outputTokenAddress}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return parseFloat(cached);
    }

    try {
      const [inputPrice, outputPrice] = await Promise.all([
        this.priceService.getTokenPrice(strategy.inputChainId, strategy.inputTokenAddress),
        this.priceService.getTokenPrice(strategy.outputChainId, strategy.outputTokenAddress),
      ]);

      if (!inputPrice || !outputPrice) return 0;

      const price = inputPrice / outputPrice;
      await this.redis.setex(cacheKey, 10, price.toString());

      return price;
    } catch {
      return 0;
    }
  }

  private mapFrequency(frequency: string): DCAFrequency {
    const map: Record<string, DCAFrequency> = {
      hourly: DCAFrequency.HOURLY,
      daily: DCAFrequency.DAILY,
      weekly: DCAFrequency.WEEKLY,
      biweekly: DCAFrequency.BIWEEKLY,
      monthly: DCAFrequency.MONTHLY,
      custom: DCAFrequency.CUSTOM,
    };
    return map[frequency] || DCAFrequency.DAILY;
  }

  private async invalidateStatsCache(userId: string): Promise<void> {
    await this.redis.del(`dca:stats:${userId}`);
  }
}
