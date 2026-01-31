import request from 'supertest';
import express, { Express } from 'express';
import { prismaMock } from '../setup';
import alertsRouter from '../../routes/alerts';
import { Prisma } from '@prisma/client';

// Mock services
const mockAlertService = {
  createAlert: jest.fn(),
  updateAlert: jest.fn(),
  deleteAlert: jest.fn(),
  getAlert: jest.fn(),
  getUserAlerts: jest.fn(),
  getAlertStats: jest.fn(),
  getAlertHistory: jest.fn(),
};

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'user_test123', email: 'test@example.com' };
    next();
  },
}));

// Mock rate limit middleware
jest.mock('../../middleware/rateLimit', () => ({
  rateLimit: () => (req: any, res: any, next: any) => next(),
}));

describe('Alerts API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.set('alertService', mockAlertService);
    app.use('/api/v1/alerts', alertsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GET /api/v1/alerts
  // ==========================================================================

  describe('GET /api/v1/alerts', () => {
    it('should return user alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert_1',
          userId: 'user_test123',
          tokenAddress: '0xtoken123',
          tokenSymbol: 'TEST',
          tokenName: 'Test Token',
          chainId: 1,
          alertType: 'ABOVE',
          targetPrice: new Prisma.Decimal(150),
          currentPrice: 100,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAlertService.getUserAlerts.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/api/v1/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toHaveLength(1);
      expect(mockAlertService.getUserAlerts).toHaveBeenCalledWith('user_test123');
    });
  });

  // ==========================================================================
  // GET /api/v1/alerts/stats
  // ==========================================================================

  describe('GET /api/v1/alerts/stats', () => {
    it('should return alert stats', async () => {
      mockAlertService.getAlertStats.mockResolvedValue({
        totalAlerts: 10,
        activeAlerts: 5,
        triggeredToday: 2,
        triggeredTotal: 50,
      });

      const response = await request(app)
        .get('/api/v1/alerts/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.totalAlerts).toBe(10);
      expect(response.body.activeAlerts).toBe(5);
    });
  });

  // ==========================================================================
  // POST /api/v1/alerts
  // ==========================================================================

  describe('POST /api/v1/alerts', () => {
    it('should create a new alert', async () => {
      const newAlert = {
        id: 'alert_new',
        userId: 'user_test123',
        tokenAddress: '0xtoken123',
        tokenSymbol: 'TEST',
        tokenName: 'Test Token',
        chainId: 1,
        alertType: 'ABOVE',
        targetPrice: new Prisma.Decimal(150),
        currentPrice: 100,
        priceAtCreation: new Prisma.Decimal(100),
        isEnabled: true,
        isRecurring: false,
        cooldownMinutes: 0,
        triggerCount: 0,
        notifyEmail: true,
        notifyPush: true,
        notifyTelegram: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAlertService.createAlert.mockResolvedValue(newAlert);

      const response = await request(app)
        .post('/api/v1/alerts')
        .send({
          tokenAddress: '0xtoken123',
          tokenSymbol: 'TEST',
          tokenName: 'Test Token',
          chainId: 1,
          alertType: 'above',
          targetPrice: 150,
          notifyEmail: true,
          notifyPush: true,
          notifyTelegram: false,
          isRecurring: false,
          cooldownMinutes: 0,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('alert_new');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/alerts')
        .send({
          tokenAddress: '0xtoken123',
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require target for above/below alerts', async () => {
      const response = await request(app)
        .post('/api/v1/alerts')
        .send({
          tokenAddress: '0xtoken123',
          tokenSymbol: 'TEST',
          tokenName: 'Test Token',
          chainId: 1,
          alertType: 'above',
          // Missing targetPrice
          notifyEmail: true,
          notifyPush: true,
          notifyTelegram: false,
          isRecurring: false,
          cooldownMinutes: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require telegramChatId when telegram enabled', async () => {
      const response = await request(app)
        .post('/api/v1/alerts')
        .send({
          tokenAddress: '0xtoken123',
          tokenSymbol: 'TEST',
          tokenName: 'Test Token',
          chainId: 1,
          alertType: 'above',
          targetPrice: 150,
          notifyEmail: false,
          notifyPush: false,
          notifyTelegram: true,
          // Missing telegramChatId
          isRecurring: false,
          cooldownMinutes: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // PATCH /api/v1/alerts/:alertId
  // ==========================================================================

  describe('PATCH /api/v1/alerts/:alertId', () => {
    it('should update an alert', async () => {
      const updatedAlert = {
        id: 'alert_1',
        targetPrice: new Prisma.Decimal(200),
        currentPrice: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAlertService.updateAlert.mockResolvedValue(updatedAlert);

      const response = await request(app)
        .patch('/api/v1/alerts/clxxxxxxxxxxxxxxxxxxxxxxxxx')
        .send({ targetPrice: 200 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate alertId format', async () => {
      const response = await request(app)
        .patch('/api/v1/alerts/invalid-id')
        .send({ isEnabled: false })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // DELETE /api/v1/alerts/:alertId
  // ==========================================================================

  describe('DELETE /api/v1/alerts/:alertId', () => {
    it('should delete an alert', async () => {
      mockAlertService.deleteAlert.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/v1/alerts/clxxxxxxxxxxxxxxxxxxxxxxxxx')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert deleted successfully');
    });
  });

  // ==========================================================================
  // GET /api/v1/alerts/history
  // ==========================================================================

  describe('GET /api/v1/alerts/history', () => {
    it('should return alert history with pagination', async () => {
      const mockHistory = [
        {
          id: 'history_1',
          alertId: 'alert_1',
          tokenSymbol: 'TEST',
          triggeredPrice: 155,
          triggeredAt: new Date(),
          notificationsSent: ['email', 'push'],
        },
      ];

      mockAlertService.getAlertHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/v1/alerts/history?limit=10&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.history).toHaveLength(1);
    });
  });
});
