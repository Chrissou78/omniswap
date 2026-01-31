import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LimitOrderStatus, LimitOrderType } from '@prisma/client';
import { LimitOrderService } from '@omniswap/core/services/limit-order.service';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createOrderSchema = z.object({
  body: z.object({
    orderType: z.enum(['buy', 'sell']),
    inputTokenAddress: z.string().min(1),
    inputTokenSymbol: z.string().min(1).max(20),
    inputTokenDecimals: z.number().int().min(0).max(18),
    inputTokenLogoURI: z.string().url().optional(),
    inputChainId: z.number().int().positive(),
    inputAmount: z.string().regex(/^\d+\.?\d*$/, 'Invalid amount'),
    outputTokenAddress: z.string().min(1),
    outputTokenSymbol: z.string().min(1).max(20),
    outputTokenDecimals: z.number().int().min(0).max(18),
    outputTokenLogoURI: z.string().url().optional(),
    outputChainId: z.number().int().positive(),
    targetPrice: z.string().regex(/^\d+\.?\d*$/, 'Invalid price'),
    slippageBps: z.number().int().min(1).max(5000).optional(), // 0.01% - 50%
    expiresIn: z.number().int().min(60000).max(2592000000).optional(), // 1 min - 30 days
    partialFillAllowed: z.boolean().optional(),
  }),
});

const updateOrderSchema = z.object({
  params: z.object({
    orderId: z.string().cuid(),
  }),
  body: z.object({
    targetPrice: z.string().regex(/^\d+\.?\d*$/).optional(),
    slippageBps: z.number().int().min(1).max(5000).optional(),
    expiresAt: z.string().datetime().optional(),
    partialFillAllowed: z.boolean().optional(),
  }),
});

const getOrderSchema = z.object({
  params: z.object({
    orderId: z.string().cuid(),
  }),
});

const listOrdersSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    orderType: z.enum(['BUY', 'SELL']).optional(),
    chainId: z.coerce.number().int().positive().optional(),
    tokenAddress: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * @route   GET /api/v1/limit-orders
 * @desc    Get user's limit orders
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  validate(listOrdersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitOrderService: LimitOrderService = req.app.get('limitOrderService');
      const userId = req.user!.id;
      const { status, orderType, chainId, tokenAddress, limit, offset } = req.query as any;

      const filters: any = {};
      if (status) {
        filters.status = status.split(',').map((s: string) => s.toUpperCase() as LimitOrderStatus);
      }
      if (orderType) {
        filters.orderType = orderType as LimitOrderType;
      }
      if (chainId) {
        filters.chainId = chainId;
      }
      if (tokenAddress) {
        filters.tokenAddress = tokenAddress;
      }

      const { orders, total } = await limitOrderService.getUserOrders(
        userId,
        filters,
        limit,
        offset
      );

      res.json({
        success: true,
        orders: orders.map(formatOrderResponse),
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
 * @route   GET /api/v1/limit-orders/stats
 * @desc    Get user's limit order statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitOrderService: LimitOrderService = req.app.get('limitOrderService');
      const userId = req.user!.id;

      const stats = await limitOrderService.getOrderStats(userId);

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
 * @route   POST /api/v1/limit-orders
 * @desc    Create a new limit order
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  rateLimit({ windowMs: 60000, max: 20 }),
  validate(createOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitOrderService: LimitOrderService = req.app.get('limitOrderService');
      const userId = req.user!.id;
      const tenantId = req.tenant?.id;

      const order = await limitOrderService.createOrder({
        userId,
        tenantId,
        ...req.body,
      });

      logger.info('Limit order created via API', { orderId: order.id, userId });

      res.status(201).json({
        success: true,
        ...formatOrderResponse(order),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/limit-orders/:orderId
 * @desc    Get a specific limit order
 * @access  Private
 */
router.get(
  '/:orderId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  validate(getOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitOrderService: LimitOrderService = req.app.get('limitOrderService');
      const userId = req.user!.id;
      const { orderId } = req.params;

      const order = await limitOrderService.getOrder(orderId, userId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      res.json({
        success: true,
        ...formatOrderResponse(order),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/v1/limit-orders/:orderId
 * @desc    Update a limit order
 * @access  Private
 */
router.patch(
  '/:orderId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 20 }),
  validate(updateOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitOrderService: LimitOrderService = req.app.get('limitOrderService');
      const userId = req.user!.id;
      const { orderId } = req.params;

      const order = await limitOrderService.updateOrder(orderId, userId, {
        ...req.body,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      });

      logger.info('Limit order updated via API', { orderId, userId });

      res.json({
        success: true,
        ...formatOrderResponse(order),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/v1/limit-orders/:orderId
 * @desc    Cancel a limit order
 * @access  Private
 */
router.delete(
  '/:orderId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 20 }),
  validate(getOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitOrderService: LimitOrderService = req.app.get('limitOrderService');
      const userId = req.user!.id;
      const { orderId } = req.params;

      await limitOrderService.cancelOrder(orderId, userId);

      logger.info('Limit order cancelled via API', { orderId, userId });

      res.json({
        success: true,
        message: 'Order cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// Response Formatter
// ============================================================================

function formatOrderResponse(order: any) {
  return {
    id: order.id,
    userId: order.userId,
    tenantId: order.tenantId,
    orderType: order.orderType.toLowerCase(),
    status: order.status.toLowerCase(),
    inputToken: {
      address: order.inputTokenAddress,
      symbol: order.inputTokenSymbol,
      decimals: order.inputTokenDecimals,
      logoURI: order.inputTokenLogoURI,
      chainId: order.inputChainId,
    },
    outputToken: {
      address: order.outputTokenAddress,
      symbol: order.outputTokenSymbol,
      decimals: order.outputTokenDecimals,
      logoURI: order.outputTokenLogoURI,
      chainId: order.outputChainId,
    },
    inputAmount: order.inputAmount.toString(),
    outputAmount: order.outputAmount?.toString() || null,
    targetPrice: order.targetPrice.toString(),
    currentPrice: order.currentPrice,
    executionPrice: order.executionPrice?.toString() || null,
    priceAtCreation: order.priceAtCreation.toString(),
    distancePercent: order.distancePercent,
    slippageBps: order.slippageBps,
    expiresAt: order.expiresAt?.toISOString() || null,
    partialFillAllowed: order.partialFillAllowed,
    filledAmount: order.filledAmount.toString(),
    fillPercent: order.fillPercent.toString(),
    platformFeeBps: order.platformFeeBps,
    platformFeeAmount: order.platformFeeAmount?.toString() || null,
    gasFeeEstimate: order.gasFeeEstimate?.toString() || null,
    gasFeeActual: order.gasFeeActual?.toString() || null,
    txHash: order.txHash,
    blockNumber: order.blockNumber?.toString() || null,
    errorMessage: order.errorMessage,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    executedAt: order.executedAt?.toISOString() || null,
    cancelledAt: order.cancelledAt?.toISOString() || null,
    fills: order.fills?.map((fill: any) => ({
      id: fill.id,
      fillAmount: fill.fillAmount.toString(),
      fillPrice: fill.fillPrice.toString(),
      outputAmount: fill.outputAmount.toString(),
      txHash: fill.txHash,
      blockNumber: fill.blockNumber.toString(),
      gasUsed: fill.gasUsed?.toString() || null,
      filledAt: fill.filledAt.toISOString(),
    })) || [],
  };
}

export default router;
