import request from 'supertest';
import express, { Express } from 'express';
import dcaRouter from '../../routes/dca';
import { Prisma } from '@prisma/client';

const mockDCAService = {
  createStrategy: jest.fn(),
  updateStrategy: jest.fn(),
  pauseStrategy: jest.fn(),
  resumeStrategy: jest.fn(),
  cancelStrategy: jest.fn(),
  getStrategy: jest.fn(),
  getUserStrategies: jest.fn(),
  getStats: jest.fn(),
  getStrategyAnalytics: jest.fn(),
  getExecutions: jest.fn(),
};

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'user_test123' };
    req.tenant = { id: 'tenant_test' };
    next();
  },
}));

jest.mock('../../middleware/rateLimit', () => ({
  rateLimit: () => (req: any, res: any, next: any) => next(),
}));

describe('DCA API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.set('dcaService', mockDCAService);
    app.use('/api/v1/dca', dcaRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/dca', () => {
    it('should return user strategies', async () => {
      mockDCAService.getUserStrategies.mockResolvedValue({
        strategies: [
          {
            id: 'dca_1',
            name: 'Test DCA',
            status: 'ACTIVE',
            frequency: 'DAILY',
            totalExecutions: 30,
            executionsCompleted: 5,
            amountPerExecution: new Prisma.Decimal(100),
            totalInputSpent: new Prisma.Decimal(500),
            totalOutputReceived: new Prisma.Decimal(0.25),
            currentPrice: 2100,
            unrealizedPnL: 25,
            unrealizedPnLPercent: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });

      const response = await request(app)
        .get('/api/v1/dca')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.strategies).toHaveLength(1);
    });
  });

  describe('POST /api/v1/dca', () => {
    it('should create a DCA strategy', async () => {
      const newStrategy = {
        id: 'dca_new',
        name: 'New DCA Strategy',
        status: 'ACTIVE',
        frequency: 'DAILY',
        totalExecutions: 30,
        executionsCompleted: 0,
        amountPerExecution: new Prisma.Decimal(100),
        totalInputSpent: new Prisma.Decimal(0),
        totalOutputReceived: new Prisma.Decimal(0),
        totalPlatformFees: new Prisma.Decimal(0),
        totalGasFees: new Prisma.Decimal(0),
        platformFeeBps: 40,
        currentPrice: 2100,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        nextExecutionAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDCAService.createStrategy.mockResolvedValue(newStrategy);

      const response = await request(app)
        .post('/api/v1/dca')
        .send({
          inputTokenAddress: '0xusdc123',
          inputTokenSymbol: 'USDC',
          inputTokenDecimals: 6,
          inputChainId: 1,
          outputTokenAddress: '0xeth123',
          outputTokenSymbol: 'ETH',
          outputTokenDecimals: 18,
          outputChainId: 1,
          amountPerExecution: '100',
          frequency: 'daily',
          totalExecutions: 30,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('dca_new');
    });

    it('should require customIntervalMs for custom frequency', async () => {
      const response = await request(app)
        .post('/api/v1/dca')
        .send({
          inputTokenAddress: '0xusdc123',
          inputTokenSymbol: 'USDC',
          inputTokenDecimals: 6,
          inputChainId: 1,
          outputTokenAddress: '0xeth123',
          outputTokenSymbol: 'ETH',
          outputTokenDecimals: 18,
          outputChainId: 1,
          amountPerExecution: '100',
          frequency: 'custom',
          // Missing customIntervalMs
          totalExecutions: 30,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate totalExecutions range', async () => {
      const response = await request(app)
        .post('/api/v1/dca')
        .send({
          inputTokenAddress: '0xusdc123',
          inputTokenSymbol: 'USDC',
          inputTokenDecimals: 6,
          inputChainId: 1,
          outputTokenAddress: '0xeth123',
          outputTokenSymbol: 'ETH',
          outputTokenDecimals: 18,
          outputChainId: 1,
          amountPerExecution: '100',
          frequency: 'daily',
          totalExecutions: 500, // Max is 365
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/dca/:strategyId/pause', () => {
    it('should pause a strategy', async () => {
      mockDCAService.pauseStrategy.mockResolvedValue({
        id: 'dca_1',
        status: 'PAUSED',
      });

      const response = await request(app)
        .post('/api/v1/dca/clxxxxxxxxxxxxxxxxxxxxxxxxx/pause')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('paused');
    });
  });

  describe('POST /api/v1/dca/:strategyId/resume', () => {
    it('should resume a strategy', async () => {
      mockDCAService.resumeStrategy.mockResolvedValue({
        id: 'dca_1',
        status: 'ACTIVE',
        nextExecutionAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/dca/clxxxxxxxxxxxxxxxxxxxxxxxxx/resume')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('active');
    });
  });

  describe('DELETE /api/v1/dca/:strategyId', () => {
    it('should cancel a strategy', async () => {
      mockDCAService.cancelStrategy.mockResolvedValue({
        id: 'dca_1',
        status: 'CANCELLED',
      });

      const response = await request(app)
        .delete('/api/v1/dca/clxxxxxxxxxxxxxxxxxxxxxxxxx')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Strategy cancelled');
    });
  });

  describe('GET /api/v1/dca/:strategyId/analytics', () => {
    it('should return strategy analytics', async () => {
      mockDCAService.getStrategyAnalytics.mockResolvedValue({
        executionHistory: [
          { date: '2024-01-01', inputAmount: 100, outputAmount: 0.05, price: 2000 },
        ],
        averagePrice: 2000,
        currentPrice: 2100,
        performancePercent: 5,
      });

      const response = await request(app)
        .get('/api/v1/dca/clxxxxxxxxxxxxxxxxxxxxxxxxx/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.executionHistory).toHaveLength(1);
      expect(response.body.performancePercent).toBe(5);
    });
  });

  describe('GET /api/v1/dca/:strategyId/executions', () => {
    it('should return strategy executions', async () => {
      mockDCAService.getExecutions.mockResolvedValue({
        executions: [
          {
            id: 'exec_1',
            executionNumber: 1,
            status: 'COMPLETED',
            inputAmount: new Prisma.Decimal(100),
            outputAmount: new Prisma.Decimal(0.05),
            scheduledAt: new Date(),
            completedAt: new Date(),
          },
        ],
        total: 1,
      });

      const response = await request(app)
        .get('/api/v1/dca/clxxxxxxxxxxxxxxxxxxxxxxxxx/executions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.executions).toHaveLength(1);
    });
  });

  describe('GET /api/v1/dca/stats', () => {
    it('should return DCA stats', async () => {
      mockDCAService.getStats.mockResolvedValue({
        totalStrategies: 5,
        activeStrategies: 3,
        completedStrategies: 2,
        totalInvested: 5000,
        totalReceived: 2.5,
        totalFees: 25,
      });

      const response = await request(app)
        .get('/api/v1/dca/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.totalStrategies).toBe(5);
      expect(response.body.activeStrategies).toBe(3);
    });
  });
});
