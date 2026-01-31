import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DCAStatus } from '@prisma/client';
import { DCAService } from '@omniswap/core/services/dca.service';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createDCASchema = z.object({
  body: z.object({
    name: z.string().max(100).optional(),
    inputTokenAddress: z.string().min(1),
    inputTokenSymbol: z.string().min(1).max(20),
    inputTokenDecimals: z.number().int().min(0).max(18),
    inputTokenLogoURI: z.string().url().optional(),
    inputChainId: z.number().int().positive(),
    outputTokenAddress: z.string().min(1),
    outputTokenSymbol: z.string().min(1).max(20),
    outputTokenDecimals: z.number().int().min(0).max(18),
    outputTokenLogoURI: z.string().url().optional(),
    outputChainId: z.number().int().positive(),
    amountPerExecution: z.string().regex(/^\d+\.?\d*$/, 'Invalid amount'),
    frequency: z.enum(['hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'custom']),
    customIntervalMs: z.number().int().min(3600000).max(2592000000).optional(), // 1 hour - 30 days
    totalExecutions: z.number().int().min(2).max(365),
    slippageBps: z.number().int().min(1).max(5000).optional(),
    maxPriceImpactBps: z.number().int().min(1).max(5000).optional(),
    skipOnHighGas: z.boolean().optional(),
    maxGasUsd: z.number().positive().max(1000).optional(),
  }).refine(
    (data) => {
      if (data.frequency === 'custom') {
        return data.customIntervalMs !== undefined;
      }
      return true;
    },
    { message: 'customIntervalMs required for custom frequency' }
  ),
});

const updateDCASchema = z.object({
  params: z.object({
    strategyId: z.string().cuid(),
  }),
  body: z.object({
    name: z.string().max(100).optional(),
    slippageBps: z.number().int().min(1).max(5000).optional(),
    maxPriceImpactBps: z.number().int().min(1).max(5000).optional(),
    skipOnHighGas: z.boolean().optional(),
    maxGasUsd: z.number().positive().max(1000).optional().nullable(),
  }),
});

const getStrategySchema = z.object({
  params: z.object({
    strategyId: z.string().cuid(),
  }),
});

const listStrategiesSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

const getExecutionsSchema = z.object({
  params: z.object({
    strategyId: z.string().cuid(),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * @route   GET /api/v1/dca
 * @desc    Get user's DCA strategies
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  validate(listStrategiesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { status, limit, offset } = req.query as any;

      let statusFilter: DCAStatus[] | undefined;
      if (status) {
        statusFilter = status.split(',').map((s: string) => s.toUpperCase() as DCAStatus);
      }

      const { strategies, total } = await dcaService.getUserStrategies(
        userId,
        statusFilter,
        limit,
        offset
      );

      res.json({
        success: true,
        strategies: strategies.map(formatStrategyResponse),
        total,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/dca/stats
 * @desc    Get user's DCA statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;

      const stats = await dcaService.getStats(userId);

      res.json({
        success: true,
        ...stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/dca
 * @desc    Create a new DCA strategy
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  rateLimit({ windowMs: 60000, max: 10 }),
  validate(createDCASchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const tenantId = req.tenant?.id;

      const strategy = await dcaService.createStrategy({
        userId,
        tenantId,
        ...req.body,
      });

      logger.info('DCA strategy created via API', { strategyId: strategy.id, userId });

      res.status(201).json({
        success: true,
        ...formatStrategyResponse(strategy),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/dca/:strategyId
 * @desc    Get a specific DCA strategy
 * @access  Private
 */
router.get(
  '/:strategyId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  validate(getStrategySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { strategyId } = req.params;

      const strategy = await dcaService.getStrategy(strategyId, userId);

      if (!strategy) {
        return res.status(404).json({
          success: false,
          message: 'Strategy not found',
        });
      }

      res.json({
        success: true,
        ...formatStrategyResponse(strategy),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/dca/:strategyId/analytics
 * @desc    Get analytics for a DCA strategy
 * @access  Private
 */
router.get(
  '/:strategyId/analytics',
  authenticate,
  rateLimit({ windowMs: 60000, max: 30 }),
  validate(getStrategySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { strategyId } = req.params;

      const analytics = await dcaService.getStrategyAnalytics(strategyId, userId);

      if (!analytics) {
        return res.status(404).json({
          success: false,
          message: 'Strategy not found',
        });
      }

      res.json({
        success: true,
        ...analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/dca/:strategyId/executions
 * @desc    Get executions for a DCA strategy
 * @access  Private
 */
router.get(
  '/:strategyId/executions',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  validate(getExecutionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { strategyId } = req.params;
      const { limit, offset } = req.query as any;

      const { executions, total } = await dcaService.getExecutions(
        strategyId,
        userId,
        limit,
        offset
      );

      res.json({
        success: true,
        executions: executions.map(formatExecutionResponse),
        total,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/v1/dca/:strategyId
 * @desc    Update a DCA strategy
 * @access  Private
 */
router.patch(
  '/:strategyId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 20 }),
  validate(updateDCASchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { strategyId } = req.params;

      const strategy = await dcaService.updateStrategy(strategyId, userId, req.body);

      logger.info('DCA strategy updated via API', { strategyId, userId });

      res.json({
        success: true,
        ...formatStrategyResponse(strategy),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/dca/:strategyId/pause
 * @desc    Pause a DCA strategy
 * @access  Private
 */
router.post(
  '/:strategyId/pause',
  authenticate,
  rateLimit({ windowMs: 60000, max: 20 }),
  validate(getStrategySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { strategyId } = req.params;

      const strategy = await dcaService.pauseStrategy(strategyId, userId);

      logger.info('DCA strategy paused via API', { strategyId, userId });

      res.json({
        success: true,
        message: 'Strategy paused',
        id: strategy.id,
        status: strategy.status.toLowerCase(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/dca/:strategyId/resume
 * @desc    Resume a DCA strategy
 * @access  Private
 */
router.post(
  '/:strategyId/resume',
  authenticate,
  rateLimit({ windowMs: 60000, max: 20 }),
  validate(getStrategySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { strategyId } = req.params;

      const strategy = await dcaService.resumeStrategy(strategyId, userId);

      logger.info('DCA strategy resumed via API', { strategyId, userId });

      res.json({
        success: true,
        message: 'Strategy resumed',
        id: strategy.id,
        status: strategy.status.toLowerCase(),
        nextExecutionAt: strategy.nextExecutionAt?.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/v1/dca/:strategyId
 * @desc    Cancel a DCA strategy
 * @access  Private
 */
router.delete(
  '/:strategyId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 20 }),
  validate(getStrategySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dcaService: DCAService = req.app.get('dcaService');
      const userId = req.user!.id;
      const { strategyId } = req.params;

      await dcaService.cancelStrategy(strategyId, userId);

      logger.info('DCA strategy cancelled via API', { strategyId, userId });

      res.json({
        success: true,
        message: 'Strategy cancelled',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// Response Formatters
// ============================================================================

function formatStrategyResponse(strategy: any) {
  return {
    id: strategy.id,
    userId: strategy.userId,
    tenantId: strategy.tenantId,
    name: strategy.name,
    status: strategy.status.toLowerCase(),
    inputToken: {
      address: strategy.inputTokenAddress,
      symbol: strategy.inputTokenSymbol,
      decimals: strategy.inputTokenDecimals,
      logoURI: strategy.inputTokenLogoURI,
      chainId: strategy.inputChainId,
    },
    outputToken: {
      address: strategy.outputTokenAddress,
      symbol: strategy.outputTokenSymbol,
      decimals: strategy.outputTokenDecimals,
      logoURI: strategy.outputTokenLogoURI,
      chainId: strategy.outputChainId,
    },
    amountPerExecution: strategy.amountPerExecution.toString(),
    frequency: strategy.frequency.toLowerCase(),
    customIntervalMs: strategy.customIntervalMs?.toString() || null,
    totalExecutions: strategy.totalExecutions,
    executionsCompleted: strategy.executionsCompleted,
    nextExecutionAt: strategy.nextExecutionAt?.toISOString() || null,
    progress: Math.round((strategy.executionsCompleted / strategy.totalExecutions) * 100),
    slippageBps: strategy.slippageBps,
    maxPriceImpactBps: strategy.maxPriceImpactBps,
    skipOnHighGas: strategy.skipOnHighGas,
    maxGasUsd: strategy.maxGasUsd?.toString() || null,
    stats: {
      totalInputSpent: strategy.totalInputSpent.toString(),
      totalOutputReceived: strategy.totalOutputReceived.toString(),
      averagePrice: strategy.averagePrice?.toString() || null,
      currentPrice: strategy.currentPrice,
      unrealizedPnL: strategy.unrealizedPnL,
      unrealizedPnLPercent: strategy.unrealizedPnLPercent,
    },
    fees: {
      platformFeeBps: strategy.platformFeeBps,
      totalPlatformFees: strategy.totalPlatformFees.toString(),
      totalGasFees: strategy.totalGasFees.toString(),
    },
    consecutiveFailures: strategy.consecutiveFailures,
    lastError: strategy.lastError,
    createdAt: strategy.createdAt.toISOString(),
    updatedAt: strategy.updatedAt.toISOString(),
    pausedAt: strategy.pausedAt?.toISOString() || null,
    completedAt: strategy.completedAt?.toISOString() || null,
    cancelledAt: strategy.cancelledAt?.toISOString() || null,
    recentExecutions: strategy.executions?.map(formatExecutionResponse) || [],
  };
}

function formatExecutionResponse(execution: any) {
  return {
    id: execution.id,
    strategyId: execution.strategyId,
    executionNumber: execution.executionNumber,
    status: execution.status.toLowerCase(),
    inputAmount: execution.inputAmount.toString(),
    outputAmount: execution.outputAmount?.toString() || null,
    executionPrice: execution.executionPrice?.toString() || null,
    priceImpactBps: execution.priceImpactBps,
    platformFeeAmount: execution.platformFeeAmount?.toString() || null,
    gasFeeAmount: execution.gasFeeAmount?.toString() || null,
    txHash: execution.txHash,
    blockNumber: execution.blockNumber?.toString() || null,
    errorMessage: execution.errorMessage,
    scheduledAt: execution.scheduledAt.toISOString(),
    startedAt: execution.startedAt?.toISOString() || null,
    completedAt: execution.completedAt?.toISOString() || null,
  };
}

export default router;
