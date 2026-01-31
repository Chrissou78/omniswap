import { Prisma, LimitOrderStatus, LimitOrderType } from '@prisma/client';
import { LimitOrderService } from '../../services/limit-order.service';
import { prismaMock, redisMock } from '../setup';
import {
  createMockLimitOrder,
  createMockPriceService,
  createMockQuoteService,
  createMockSwapService,
  createMockQueue,
} from '../utils/test-helpers';

describe('LimitOrderService', () => {
  let limitOrderService: LimitOrderService;
  let mockPriceService: ReturnType<typeof createMockPriceService>;
  let mockQuoteService: ReturnType<typeof createMockQuoteService>;
  let mockSwapService: ReturnType<typeof createMockSwapService>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockPriceService = createMockPriceService();
    mockQuoteService = createMockQuoteService();
    mockSwapService = createMockSwapService();
    mockQueue = createMockQueue();

    // Mock price calculations
    mockPriceService.getTokenPrice
      .mockResolvedValueOnce(1) // USDC = $1
      .mockResolvedValueOnce(2100); // ETH = $2100

    limitOrderService = new LimitOrderService(
      prismaMock as any,
      redisMock as any,
      mockPriceService as any,
      mockQuoteService as any,
      mockSwapService as any,
      mockQueue as any
    );

    // Default Redis mocks
    redisMock.get.mockResolvedValue(null);
    redisMock.setex.mockResolvedValue('OK');
    redisMock.del.mockResolvedValue(1);
  });

  // ==========================================================================
  // createOrder Tests
  // ==========================================================================

  describe('createOrder', () => {
    beforeEach(() => {
      // Reset price mock for each test
      mockPriceService.getTokenPrice
        .mockReset()
        .mockResolvedValueOnce(1) // USDC
        .mockResolvedValueOnce(2100); // ETH
    });

    it('should create a buy order successfully', async () => {
      const mockOrder = createMockLimitOrder();
      
      prismaMock.limitOrder.create.mockResolvedValue(mockOrder as any);

      const result = await limitOrderService.createOrder({
        userId: 'user_test123',
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
        targetPrice: '2000', // Buy when price drops to 2000
      });

      expect(result.id).toBe('order_test123');
      expect(prismaMock.limitOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_test123',
          orderType: LimitOrderType.BUY,
          status: LimitOrderStatus.PENDING,
        }),
      });
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should create a sell order successfully', async () => {
      // For sell order: selling ETH for USDC
      mockPriceService.getTokenPrice
        .mockReset()
        .mockResolvedValueOnce(2100) // ETH
        .mockResolvedValueOnce(1); // USDC

      const mockOrder = createMockLimitOrder({ orderType: 'SELL' });
      prismaMock.limitOrder.create.mockResolvedValue(mockOrder as any);

      const result = await limitOrderService.createOrder({
        userId: 'user_test123',
        orderType: 'sell',
        inputTokenAddress: '0xeth123',
        inputTokenSymbol: 'ETH',
        inputTokenDecimals: 18,
        inputChainId: 1,
        inputAmount: '1',
        outputTokenAddress: '0xusdc123',
        outputTokenSymbol: 'USDC',
        outputTokenDecimals: 6,
        outputChainId: 1,
        targetPrice: '2500', // Sell when price rises to 2500
      });

      expect(prismaMock.limitOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderType: LimitOrderType.SELL,
        }),
      });
    });

    it('should throw error for buy order with target above current price', async () => {
      await expect(
        limitOrderService.createOrder({
          userId: 'user_test123',
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
          targetPrice: '2500', // Above current price of ~2100
        })
      ).rejects.toThrow('Buy order target price must be below current market price');
    });

    it('should throw error for sell order with target below current price', async () => {
      mockPriceService.getTokenPrice
        .mockReset()
        .mockResolvedValueOnce(2100)
        .mockResolvedValueOnce(1);

      await expect(
        limitOrderService.createOrder({
          userId: 'user_test123',
          orderType: 'sell',
          inputTokenAddress: '0xeth123',
          inputTokenSymbol: 'ETH',
          inputTokenDecimals: 18,
          inputChainId: 1,
          inputAmount: '1',
          outputTokenAddress: '0xusdc123',
          outputTokenSymbol: 'USDC',
          outputTokenDecimals: 6,
          outputChainId: 1,
          targetPrice: '1800', // Below current price
        })
      ).rejects.toThrow('Sell order target price must be above current market price');
    });

    it('should throw error if price cannot be fetched', async () => {
      mockPriceService.getTokenPrice.mockReset().mockResolvedValue(null);

      await expect(
        limitOrderService.createOrder({
          userId: 'user_test123',
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
      ).rejects.toThrow('Unable to fetch current market price');
    });

    it('should set expiration if expiresIn provided', async () => {
      const mockOrder = createMockLimitOrder();
      prismaMock.limitOrder.create.mockResolvedValue(mockOrder as any);

      await limitOrderService.createOrder({
        userId: 'user_test123',
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
        expiresIn: 86400000, // 24 hours
      });

      expect(prismaMock.limitOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  // ==========================================================================
  // cancelOrder Tests
  // ==========================================================================

  describe('cancelOrder', () => {
    it('should cancel a pending order', async () => {
      const mockOrder = createMockLimitOrder();
      
      prismaMock.limitOrder.findFirst.mockResolvedValue(mockOrder as any);
      prismaMock.limitOrder.update.mockResolvedValue({
        ...mockOrder,
        status: LimitOrderStatus.CANCELLED,
        cancelledAt: new Date(),
      } as any);

      const result = await limitOrderService.cancelOrder('order_test123', 'user_test123');

      expect(result.status).toBe(LimitOrderStatus.CANCELLED);
      expect(prismaMock.limitOrder.update).toHaveBeenCalledWith({
        where: { id: 'order_test123' },
        data: expect.objectContaining({
          status: LimitOrderStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        }),
      });
    });

    it('should throw error for nonexistent order', async () => {
      prismaMock.limitOrder.findFirst.mockResolvedValue(null);

      await expect(
        limitOrderService.cancelOrder('nonexistent', 'user_test123')
      ).rejects.toThrow('Order not found or cannot be cancelled');
    });

    it('should not cancel already filled order', async () => {
      prismaMock.limitOrder.findFirst.mockResolvedValue(null); // Query excludes non-pending

      await expect(
        limitOrderService.cancelOrder('filled_order', 'user_test123')
      ).rejects.toThrow('Order not found or cannot be cancelled');
    });
  });

  // ==========================================================================
  // checkOrder Tests
  // ==========================================================================

  describe('checkOrder', () => {
    beforeEach(() => {
      mockPriceService.getTokenPrice
        .mockReset()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2100);
    });

    it('should execute buy order when price drops to target', async () => {
      const mockOrder = createMockLimitOrder({
        orderType: 'BUY',
        targetPrice: new Prisma.Decimal(2000),
      });

      // Price dropped to 1950 (below target of 2000)
      mockPriceService.getTokenPrice
        .mockReset()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1950);

      prismaMock.limitOrder.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.limitOrder.update.mockResolvedValue(mockOrder as any);
      prismaMock.limitOrderFill.create.mockResolvedValue({} as any);
      prismaMock.$transaction.mockImplementation(async (fn) => {
        if (Array.isArray(fn)) {
          return Promise.all(fn);
        }
        return fn(prismaMock);
      });

      const result = await limitOrderService.checkOrder('order_test123');

      expect(result.executed).toBe(true);
      expect(mockQuoteService.getQuote).toHaveBeenCalled();
      expect(mockSwapService.executeSwap).toHaveBeenCalled();
    });

    it('should not execute buy order when price is above target', async () => {
      const mockOrder = createMockLimitOrder({
        orderType: 'BUY',
        targetPrice: new Prisma.Decimal(2000),
      });

      // Price is 2100 (above target of 2000)
      prismaMock.limitOrder.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.limitOrder.update.mockResolvedValue(mockOrder as any);

      const result = await limitOrderService.checkOrder('order_test123');

      expect(result.executed).toBe(false);
      expect(result.reason).toBe('Target price not reached');
    });

    it('should expire order if past expiration', async () => {
      const mockOrder = createMockLimitOrder({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      prismaMock.limitOrder.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.limitOrder.update.mockResolvedValue({
        ...mockOrder,
        status: LimitOrderStatus.EXPIRED,
      } as any);

      const result = await limitOrderService.checkOrder('order_test123');

      expect(result.executed).toBe(false);
      expect(result.reason).toBe('Order expired');
      expect(prismaMock.limitOrder.update).toHaveBeenCalledWith({
        where: { id: 'order_test123' },
        data: { status: LimitOrderStatus.EXPIRED },
      });
    });

    it('should return false for nonexistent order', async () => {
      prismaMock.limitOrder.findUnique.mockResolvedValue(null);

      const result = await limitOrderService.checkOrder('nonexistent');

      expect(result.executed).toBe(false);
      expect(result.reason).toBe('Order not found');
    });

    it('should return false for non-active order', async () => {
      const mockOrder = createMockLimitOrder({ status: 'FILLED' });

      prismaMock.limitOrder.findUnique.mockResolvedValue(mockOrder as any);

      const result = await limitOrderService.checkOrder('order_test123');

      expect(result.executed).toBe(false);
      expect(result.reason).toBe('Order not active');
    });
  });

  // ==========================================================================
  // getOrderStats Tests
  // ==========================================================================

  describe('getOrderStats', () => {
    it('should return stats from cache if available', async () => {
      const cachedStats = {
        totalOrders: 10,
        pendingOrders: 3,
        filledOrders: 5,
        cancelledOrders: 2,
        totalVolume: 10000,
        totalFees: 40,
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cachedStats));

      const result = await limitOrderService.getOrderStats('user_test123');

      expect(result).toEqual(cachedStats);
    });

    it('should calculate stats if not cached', async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.limitOrder.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3) // pending
        .mockResolvedValueOnce(5) // filled
        .mockResolvedValueOnce(2); // cancelled

      prismaMock.limitOrder.aggregate.mockResolvedValue({
        _sum: {
          inputAmount: new Prisma.Decimal(10000),
          platformFeeAmount: new Prisma.Decimal(40),
        },
      } as any);

      const result = await limitOrderService.getOrderStats('user_test123');

      expect(result).toEqual({
        totalOrders: 10,
        pendingOrders: 3,
        filledOrders: 5,
        cancelledOrders: 2,
        totalVolume: 10000,
        totalFees: 40,
      });
    });
  });

  // ==========================================================================
  // getUserOrders Tests
  // ==========================================================================

  describe('getUserOrders', () => {
    it('should return user orders with pagination', async () => {
      const mockOrders = [
        createMockLimitOrder({ id: 'order_1' }),
        createMockLimitOrder({ id: 'order_2' }),
      ];

      prismaMock.limitOrder.findMany.mockResolvedValue(mockOrders as any);
      prismaMock.limitOrder.count.mockResolvedValue(2);
      
      // Mock price for enrichment
      mockPriceService.getTokenPrice
        .mockResolvedValueOnce(1).mockResolvedValueOnce(2100)
        .mockResolvedValueOnce(1).mockResolvedValueOnce(2100);

      const result = await limitOrderService.getUserOrders('user_test123', undefined, 50, 0);

      expect(result.orders).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply status filter', async () => {
      prismaMock.limitOrder.findMany.mockResolvedValue([]);
      prismaMock.limitOrder.count.mockResolvedValue(0);

      await limitOrderService.getUserOrders(
        'user_test123',
        { status: [LimitOrderStatus.PENDING, LimitOrderStatus.PARTIALLY_FILLED] },
        50,
        0
      );

      expect(prismaMock.limitOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [LimitOrderStatus.PENDING, LimitOrderStatus.PARTIALLY_FILLED] },
          }),
        })
      );
    });
  });
});
