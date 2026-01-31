import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AlertService } from '@omniswap/core/services/alert.service';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createAlertSchema = z.object({
  body: z.object({
    tokenAddress: z.string().min(1),
    tokenSymbol: z.string().min(1).max(20),
    tokenName: z.string().min(1).max(100),
    tokenLogoURI: z.string().url().optional(),
    chainId: z.number().int().positive(),
    alertType: z.enum(['above', 'below', 'percent_change']),
    targetPrice: z.number().positive().optional(),
    targetPercentChange: z.number().optional(),
    isRecurring: z.boolean().optional().default(false),
    cooldownMinutes: z.number().int().min(0).max(1440).optional().default(0),
    notifyEmail: z.boolean().optional().default(true),
    notifyPush: z.boolean().optional().default(true),
    notifyTelegram: z.boolean().optional().default(false),
    telegramChatId: z.string().optional(),
    note: z.string().max(500).optional(),
  }).refine(
    (data) => {
      if (data.alertType === 'percent_change') {
        return data.targetPercentChange !== undefined;
      }
      return data.targetPrice !== undefined;
    },
    {
      message: 'targetPrice required for above/below alerts, targetPercentChange required for percent_change alerts',
    }
  ).refine(
    (data) => {
      if (data.notifyTelegram) {
        return !!data.telegramChatId;
      }
      return true;
    },
    {
      message: 'telegramChatId required when notifyTelegram is enabled',
    }
  ).refine(
    (data) => data.notifyEmail || data.notifyPush || data.notifyTelegram,
    {
      message: 'At least one notification method must be enabled',
    }
  ),
});

const updateAlertSchema = z.object({
  params: z.object({
    alertId: z.string().cuid(),
  }),
  body: z.object({
    alertType: z.enum(['above', 'below', 'percent_change']).optional(),
    targetPrice: z.number().positive().optional(),
    targetPercentChange: z.number().optional(),
    isEnabled: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
    cooldownMinutes: z.number().int().min(0).max(1440).optional(),
    notifyEmail: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    notifyTelegram: z.boolean().optional(),
    telegramChatId: z.string().optional(),
    note: z.string().max(500).optional(),
  }),
});

const getAlertSchema = z.object({
  params: z.object({
    alertId: z.string().cuid(),
  }),
});

const getHistorySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * @route   GET /api/v1/alerts
 * @desc    Get all alerts for the authenticated user
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertService: AlertService = req.app.get('alertService');
      const userId = req.user!.id;

      const alerts = await alertService.getUserAlerts(userId);

      res.json({
        success: true,
        alerts: alerts.map(formatAlertResponse),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/alerts/stats
 * @desc    Get alert statistics for the authenticated user
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertService: AlertService = req.app.get('alertService');
      const userId = req.user!.id;

      const stats = await alertService.getAlertStats(userId);

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
 * @route   GET /api/v1/alerts/history
 * @desc    Get alert trigger history for the authenticated user
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  validate(getHistorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertService: AlertService = req.app.get('alertService');
      const userId = req.user!.id;
      const { limit, offset } = req.query as { limit: number; offset: number };

      const history = await alertService.getAlertHistory(userId, limit, offset);

      res.json({
        success: true,
        history: history.map(formatHistoryResponse),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/alerts
 * @desc    Create a new price alert
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  rateLimit({ windowMs: 60000, max: 30 }),
  validate(createAlertSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertService: AlertService = req.app.get('alertService');
      const userId = req.user!.id;

      const alert = await alertService.createAlert({
        userId,
        ...req.body,
      });

      logger.info('Alert created via API', { alertId: alert.id, userId });

      res.status(201).json({
        success: true,
        ...formatAlertResponse(alert),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/alerts/:alertId
 * @desc    Get a specific alert
 * @access  Private
 */
router.get(
  '/:alertId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 60 }),
  validate(getAlertSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertService: AlertService = req.app.get('alertService');
      const userId = req.user!.id;
      const { alertId } = req.params;

      const alert = await alertService.getAlert(alertId, userId);

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found',
        });
      }

      res.json({
        success: true,
        ...formatAlertResponse(alert),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/v1/alerts/:alertId
 * @desc    Update an existing alert
 * @access  Private
 */
router.patch(
  '/:alertId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 30 }),
  validate(updateAlertSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertService: AlertService = req.app.get('alertService');
      const userId = req.user!.id;
      const { alertId } = req.params;

      const alert = await alertService.updateAlert(alertId, userId, req.body);

      logger.info('Alert updated via API', { alertId, userId });

      res.json({
        success: true,
        ...formatAlertResponse(alert),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/v1/alerts/:alertId
 * @desc    Delete an alert
 * @access  Private
 */
router.delete(
  '/:alertId',
  authenticate,
  rateLimit({ windowMs: 60000, max: 30 }),
  validate(getAlertSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertService: AlertService = req.app.get('alertService');
      const userId = req.user!.id;
      const { alertId } = req.params;

      await alertService.deleteAlert(alertId, userId);

      logger.info('Alert deleted via API', { alertId, userId });

      res.json({
        success: true,
        message: 'Alert deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// Response Formatters
// ============================================================================

function formatAlertResponse(alert: any) {
  return {
    id: alert.id,
    userId: alert.userId,
    tokenAddress: alert.tokenAddress,
    tokenSymbol: alert.tokenSymbol,
    tokenName: alert.tokenName,
    tokenLogoURI: alert.tokenLogoURI,
    chainId: alert.chainId,
    alertType: alert.alertType.toLowerCase(),
    targetPrice: alert.targetPrice ? Number(alert.targetPrice) : null,
    targetPercentChange: alert.targetPercentChange ? Number(alert.targetPercentChange) : null,
    currentPrice: alert.currentPrice,
    priceAtCreation: Number(alert.priceAtCreation),
    isEnabled: alert.isEnabled,
    isRecurring: alert.isRecurring,
    cooldownMinutes: alert.cooldownMinutes,
    lastTriggeredAt: alert.lastTriggeredAt?.toISOString() || null,
    triggerCount: alert.triggerCount,
    notifyEmail: alert.notifyEmail,
    notifyPush: alert.notifyPush,
    notifyTelegram: alert.notifyTelegram,
    telegramChatId: alert.telegramChatId,
    note: alert.note,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

function formatHistoryResponse(item: any) {
  return {
    id: item.id,
    alertId: item.alertId,
    tokenSymbol: item.tokenSymbol,
    tokenLogoURI: item.tokenLogoURI,
    chainId: item.chainId,
    alertType: item.alertType,
    targetPrice: item.targetPrice,
    targetPercentChange: item.targetPercentChange,
    triggeredPrice: item.triggeredPrice,
    notificationsSent: item.notificationsSent,
    triggeredAt: item.triggeredAt.toISOString(),
  };
}

export default router;
