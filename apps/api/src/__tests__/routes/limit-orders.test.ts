import request from 'supertest';
import express, { Express } from 'express';
import limitOrdersRouter from '../../routes/limit-orders';
import { Prisma } from '@prisma/client';

const mockLimitOrderService = {
  createOrder: jest.fn(),
  updateOrder: jest.fn(),
  cancelOrder: jest.fn(),
  getOrder: jest.fn(),
  getUserOrders: jest.fn(),
  getOrderStats: jest.fn(),
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

describe('Limit Orders API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.set('limitOrderService', mockLimitOrderService);
    app.use('/api/v1/limit-orders', limitOrdersRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/limit-orders', () => {
    it('should return user orders', async () => {
      mockLimitOrderService.getUserOrders.mockResolvedValue({
        orders: [
          {
            id: 'order_1',
            orderType: 'BUY',
            status: 'PENDING',
            inputAmount: new Prisma.Decimal(1000),
            targetPrice: new Prisma.Decimal(2000),
            currentPrice: 2100,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });

      const response = await request(app)
        .get('/api/v1/limit-orders')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orders).toHaveLength(1);
    });

    it('should apply status filter', async () => {
      mockLimitOrderService.getUserOrders.mockResolvedValue({ orders: [], total: 0 });

      await request(app)
        .get('/api/v1/limit-orders?status=PENDING,PARTIALLY_FILLED')
        .expect(200);

      expect(mockLimitOrderService.getUserOrders).toHaveBeenCalledWith(
        'user_test123',
        expect.objectContaining({
          status: ['PENDING', 'PARTIALLY_FILLED'],
        }),
        50,
        0
      );
    });
  });

  describe('POST /api/v1/limit-orders', () => {
    it('should create a buy order', async () => {
      const newOrder = {
        id: 'order_new',
        orderType: 'BUY',
        status: 'PENDING',
        inputAmount: new Prisma.Decimal(1000),
        targetPrice: new Prisma.Decimal(2000),
        currentPrice: 2100,
        distancePercent: -4.76,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLimitOrderService.createOrder.mockResolvedValue(newOrder);

      const response = await request(app)
        .post('/api/v1/limit-orders')
        .send({
          orderType: 'buy',
          inputTokenAddress: '0xusdc123',
          inputTokenSymbol: 'USDC',
          inputTokenDecimals: 6,
          inputChainId: 1,
          inputAmount: '1000',
          outputTokenAddress: '0xeth123',
          outputTokenSymbol: 'ETH',
          outputTokenDecimals: 18,
          outputChainId: 1,
          targetPrice: '2000',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe('order_new');
    });

    it('should validate amount format', async () => {
      const response = await request(app)
        .post('/api/v1/limit-orders')
        .send({
          orderType: 'buy',
          inputTokenAddress: '0xusdc123',
          inputTokenSymbol: 'USDC',
          inputTokenDecimals: 6,
          inputChainId: 1,
          inputAmount: 'invalid',
          outputTokenAddress: '0xeth123',
          outputTokenSymbol: 'ETH',
          outputTokenDecimals: 18,
          outputChainId: 1,
          targetPrice: '2000',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/limit-orders/:orderId', () => {
    it('should cancel an order', async () => {
      mockLimitOrderService.cancelOrder.mockResolvedValue({ id: 'order_1', status: 'CANCELLED' });

      const response = await request(app)
        .delete('/api/v1/limit-orders/clxxxxxxxxxxxxxxxxxxxxxxxxx')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Order cancelled successfully');
    });
  });

  describe('GET /api/v1/limit-orders/stats', () => {
    it('should return order stats', async () => {
      mockLimitOrderService.getOrderStats.mockResolvedValue({
        totalOrders: 10,
        pendingOrders: 3,
        filledOrders: 5,
        cancelledOrders: 2,
        totalVolume: 10000,
        totalFees: 40,
      });

      const response = await request(app)
        .get('/api/v1/limit-orders/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.totalOrders).toBe(10);
    });
  });
});
