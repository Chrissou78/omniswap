import { Prisma, DCAStatus, DCAFrequency, DCAExecutionStatus } from '@prisma/client';
import { DCAService } from '../../services/dca.service';
import { prismaMock, redisMock } from '../setup';
import {
  createMockDCAStrategy,
  createMockDCAExecution,
  createMockPriceService,
  createMockQuoteService,
  createMockSwapService,
  createMockGasService,
  createMockQueue,
} from '../utils/test-helpers';

describe('DCAService', () => {
  let dcaService: DCAService;
  let mockPriceService: ReturnType<typeof createMockPriceService>;
  let mockQuoteService: ReturnType<typeof createMockQuoteService>;
  let mockSwapService: ReturnType<typeof createMockSwapService>;
  let mockGasService: ReturnType<typeof createMockGasService>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockPriceService = createMockPriceService();
    mockQuoteService = createMockQuoteService();
    mockSwapService = createMockSwapService();
    mockGasService = createMockGasService();
    mockQueue = createMockQueue();

    dcaService = new DCAService(
      prismaMock as any,
      redisMock as any,
      mockPriceService as any,
      mockQuoteService as any,
      mockSwapService as any,
      mockGasService as any,
      mockQueue as any
    );

    // Default mocks
    redisMock.get.mockResolvedValue(null);
    redisMock.setex.mockResolvedValue('OK');
    redisMock.del.mockResolvedValue(1);
  });

  // ==========================================================================
  // createStrategy Tests
  // ==========================================================================

  describe('createStrategy', () => {
    it('should create a DCA strategy successfully', async () => {
      const mockStrategy = createMockDCAStrategy();
      
      prismaMock.dCAStrategy.create.mockResolvedValue(mockStrategy as any);
      mockPriceService.getTokenPrice.mockResolvedValue(2100);

      const result = await dcaService.createStrategy({
        userId: 'user_test123',
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
      });

      expect(result.id).toBe('dca_test123');
      expect(prismaMock.dCAStrategy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_test123',
          status: DCAStatus.ACTIVE,
          frequency: DCAFrequency.DAILY,
          totalExecutions: 30,
        }),
      });
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should create strategy with custom frequency', async () => {
      const mockStrategy = createMockDCAStrategy({ frequency: 'CUSTOM' });
      
      prismaMock.dCAStrategy.create.mockResolvedValue(mockStrategy as any);
      mockPriceService.getTokenPrice.mockResolvedValue(2100);

      await dcaService.createStrategy({
        userId: 'user_test123',
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
        customIntervalMs: 43200000, // 12 hours
        totalExecutions: 60,
      });

      expect(prismaMock.dCAStrategy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          frequency: DCAFrequency.CUSTOM,
          customIntervalMs: BigInt(43200000),
        }),
      });
    });

    it('should throw error for custom frequency without interval', async () => {
      await expect(
        dcaService.createStrategy({
          userId: 'user_test123',
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
          totalExecutions: 30,
        })
      ).rejects.toThrow('customIntervalMs required for custom frequency');
    });

    it('should throw error for invalid totalExecutions', async () => {
      await expect(
        dcaService.createStrategy({
          userId: 'user_test123',
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
          totalExecutions: 1, // Must be at least 2
        })
      ).rejects.toThrow('totalExecutions must be between 2 and 365');
    });

    it('should create strategy with gas protection settings', async () => {
      const mockStrategy = createMockDCAStrategy({
        skipOnHighGas: true,
        maxGasUsd: new Prisma.Decimal(10),
      });
      
      prismaMock.dCAStrategy.create.mockResolvedValue(mockStrategy as any);
      mockPriceService.getTokenPrice.mockResolvedValue(2100);

      await dcaService.createStrategy({
        userId: 'user_test123',
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
        skipOnHighGas: true,
        maxGasUsd: 10,
      });

      expect(prismaMock.dCAStrategy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          skipOnHighGas: true,
          maxGasUsd: expect.any(Prisma.Decimal),
        }),
      });
    });
  });

  // ==========================================================================
  // pauseStrategy / resumeStrategy Tests
  // ==========================================================================

  describe('pauseStrategy', () => {
    it('should pause an active strategy', async () => {
      const mockStrategy = createMockDCAStrategy();
      
      prismaMock.dCAStrategy.findFirst.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAStrategy.update.mockResolvedValue({
        ...mockStrategy,
        status: DCAStatus.PAUSED,
        pausedAt: new Date(),
      } as any);

      const result = await dcaService.pauseStrategy('dca_test123', 'user_test123');

      expect(result.status).toBe(DCAStatus.PAUSED);
      expect(prismaMock.dCAStrategy.update).toHaveBeenCalledWith({
        where: { id: 'dca_test123' },
        data: expect.objectContaining({
          status: DCAStatus.PAUSED,
          pausedAt: expect.any(Date),
        }),
      });
    });

    it('should throw error for non-active strategy', async () => {
      prismaMock.dCAStrategy.findFirst.mockResolvedValue(null);

      await expect(
        dcaService.pauseStrategy('dca_test123', 'user_test123')
      ).rejects.toThrow('Strategy not found or cannot be paused');
    });
  });

  describe('resumeStrategy', () => {
    it('should resume a paused strategy', async () => {
      const mockStrategy = createMockDCAStrategy({ status: 'PAUSED' });
      
      prismaMock.dCAStrategy.findFirst.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAStrategy.update.mockResolvedValue({
        ...mockStrategy,
        status: DCAStatus.ACTIVE,
        pausedAt: null,
        nextExecutionAt: new Date(),
      } as any);

      const result = await dcaService.resumeStrategy('dca_test123', 'user_test123');

      expect(result.status).toBe(DCAStatus.ACTIVE);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should throw error for non-paused strategy', async () => {
      prismaMock.dCAStrategy.findFirst.mockResolvedValue(null);

      await expect(
        dcaService.resumeStrategy('dca_test123', 'user_test123')
      ).rejects.toThrow('Strategy not found or cannot be resumed');
    });
  });

  // ==========================================================================
  // cancelStrategy Tests
  // ==========================================================================

  describe('cancelStrategy', () => {
    it('should cancel an active strategy', async () => {
      const mockStrategy = createMockDCAStrategy();
      
      prismaMock.dCAStrategy.findFirst.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAStrategy.update.mockResolvedValue({
        ...mockStrategy,
        status: DCAStatus.CANCELLED,
        cancelledAt: new Date(),
      } as any);

      const result = await dcaService.cancelStrategy('dca_test123', 'user_test123');

      expect(result.status).toBe(DCAStatus.CANCELLED);
    });

    it('should throw error for completed strategy', async () => {
      prismaMock.dCAStrategy.findFirst.mockResolvedValue(null);

      await expect(
        dcaService.cancelStrategy('dca_test123', 'user_test123')
      ).rejects.toThrow('Strategy not found or cannot be cancelled');
    });
  });

  // ==========================================================================
  // executeStrategy Tests
  // ==========================================================================

  describe('executeStrategy', () => {
    it('should execute strategy successfully', async () => {
      const mockStrategy = createMockDCAStrategy();
      const mockExecution = createMockDCAExecution({ status: 'PENDING' });

      prismaMock.dCAStrategy.findUnique.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAExecution.create.mockResolvedValue(mockExecution as any);
      prismaMock.dCAExecution.update.mockResolvedValue({
        ...mockExecution,
        status: DCAExecutionStatus.COMPLETED,
      } as any);
      prismaMock.dCAStrategy.update.mockResolvedValue(mockStrategy as any);

      mockQuoteService.getQuote.mockResolvedValue({
        id: 'quote_123',
        routes: [{ outputAmount: '0.05', priceImpactBps: 10 }],
      });
      mockSwapService.executeSwap.mockResolvedValue({
        txHash: '0xtx123',
        outputAmount: '0.05',
        blockNumber: 12345678,
        gasFee: '0.001',
      });

      await dcaService.executeStrategy('dca_test123', 6);

      expect(prismaMock.dCAExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DCAExecutionStatus.COMPLETED,
          }),
        })
      );
      expect(mockQueue.add).toHaveBeenCalled(); // Schedule next
    });

    it('should skip execution when gas is too high', async () => {
      const mockStrategy = createMockDCAStrategy({
        skipOnHighGas: true,
        maxGasUsd: new Prisma.Decimal(5),
      });
      const mockExecution = createMockDCAExecution({ status: 'PENDING' });

      prismaMock.dCAStrategy.findUnique.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAExecution.create.mockResolvedValue(mockExecution as any);
      prismaMock.dCAExecution.update.mockResolvedValue({
        ...mockExecution,
        status: DCAExecutionStatus.SKIPPED,
      } as any);

      mockGasService.getGasPriceUsd.mockResolvedValue(10); // Above max of 5

      await dcaService.executeStrategy('dca_test123', 6);

      expect(prismaMock.dCAExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DCAExecutionStatus.SKIPPED,
            errorMessage: 'Gas price too high',
          }),
        })
      );
    });

    it('should skip execution when price impact is too high', async () => {
      const mockStrategy = createMockDCAStrategy({
        maxPriceImpactBps: 300, // 3%
      });
      const mockExecution = createMockDCAExecution({ status: 'PENDING' });

      prismaMock.dCAStrategy.findUnique.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAExecution.create.mockResolvedValue(mockExecution as any);
      prismaMock.dCAExecution.update.mockResolvedValue({
        ...mockExecution,
        status: DCAExecutionStatus.SKIPPED,
      } as any);

      mockQuoteService.getQuote.mockResolvedValue({
        id: 'quote_123',
        routes: [{ outputAmount: '0.05', priceImpactBps: 500 }], // 5% impact
      });

      await dcaService.executeStrategy('dca_test123', 6);

      expect(prismaMock.dCAExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DCAExecutionStatus.SKIPPED,
            errorMessage: expect.stringContaining('Price impact too high'),
          }),
        })
      );
    });

    it('should not execute non-active strategy', async () => {
      const mockStrategy = createMockDCAStrategy({ status: 'PAUSED' });

      prismaMock.dCAStrategy.findUnique.mockResolvedValue(mockStrategy as any);

      await dcaService.executeStrategy('dca_test123', 6);

      expect(prismaMock.dCAExecution.create).not.toHaveBeenCalled();
    });

    it('should mark strategy as completed after final execution', async () => {
      const mockStrategy = createMockDCAStrategy({
        totalExecutions: 30,
        executionsCompleted: 29,
      });
      const mockExecution = createMockDCAExecution({ executionNumber: 30 });

      prismaMock.dCAStrategy.findUnique.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAExecution.create.mockResolvedValue(mockExecution as any);
      prismaMock.dCAExecution.update.mockResolvedValue({
        ...mockExecution,
        status: DCAExecutionStatus.COMPLETED,
      } as any);
      prismaMock.dCAStrategy.update.mockResolvedValue({
        ...mockStrategy,
        status: DCAStatus.COMPLETED,
      } as any);

      mockQuoteService.getQuote.mockResolvedValue({
        id: 'quote_123',
        routes: [{ outputAmount: '0.05', priceImpactBps: 10 }],
      });
      mockSwapService.executeSwap.mockResolvedValue({
        txHash: '0xtx123',
        outputAmount: '0.05',
        blockNumber: 12345678,
        gasFee: '0.001',
      });

      await dcaService.executeStrategy('dca_test123', 30);

      expect(prismaMock.dCAStrategy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DCAStatus.COMPLETED,
            completedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should pause strategy after max consecutive failures', async () => {
      const mockStrategy = createMockDCAStrategy({
        consecutiveFailures: 4, // Will become 5 after this failure
      });
      const mockExecution = createMockDCAExecution({ status: 'PENDING' });

      prismaMock.dCAStrategy.findUnique.mockResolvedValue(mockStrategy as any);
      prismaMock.dCAExecution.create.mockResolvedValue(mockExecution as any);
      prismaMock.dCAExecution.update.mockResolvedValue({
        ...mockExecution,
        status: DCAExecutionStatus.FAILED,
      } as any);
      prismaMock.dCAStrategy.update.mockResolvedValue({
        ...mockStrategy,
        status: DCAStatus.FAILED,
      } as any);

      mockQuoteService.getQuote.mockRejectedValue(new Error('No route available'));

      await dcaService.executeStrategy('dca_test123', 6);

      expect(prismaMock.dCAStrategy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DCAStatus.FAILED,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // getStats Tests
  // ==========================================================================

  describe('getStats', () => {
    it('should return stats from cache', async () => {
      const cachedStats = {
        totalStrategies: 5,
        activeStrategies: 3,
        completedStrategies: 2,
        totalInvested: 5000,
        totalReceived: 2.5,
        totalFees: 25,
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cachedStats));

      const result = await dcaService.getStats('user_test123');

      expect(result).toEqual(cachedStats);
    });

    it('should calculate stats if not cached', async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.dCAStrategy.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // active
        .mockResolvedValueOnce(2); // completed

      prismaMock.dCAStrategy.aggregate.mockResolvedValue({
        _sum: {
          totalInputSpent: new Prisma.Decimal(5000),
          totalOutputReceived: new Prisma.Decimal(2.5),
          totalPlatformFees: new Prisma.Decimal(20),
          totalGasFees: new Prisma.Decimal(5),
        },
      } as any);

      const result = await dcaService.getStats('user_test123');

      expect(result).toEqual({
        totalStrategies: 5,
        activeStrategies: 3,
        completedStrategies: 2,
        totalInvested: 5000,
        totalReceived: 2.5,
        totalFees: 25,
      });
    });
  });

  // ==========================================================================
  // getStrategyAnalytics Tests
  // ==========================================================================

  describe('getStrategyAnalytics', () => {
    it('should return strategy analytics', async () => {
      const mockStrategy = createMockDCAStrategy({
        averagePrice: new Prisma.Decimal(2000),
        executions: [
          createMockDCAExecution({
            executionNumber: 1,
            inputAmount: new Prisma.Decimal(100),
            outputAmount: new Prisma.Decimal(0.05),
            executionPrice: new Prisma.Decimal(2000),
            completedAt: new Date('2024-01-01'),
          }),
          createMockDCAExecution({
            executionNumber: 2,
            inputAmount: new Prisma.Decimal(100),
            outputAmount: new Prisma.Decimal(0.048),
            executionPrice: new Prisma.Decimal(2083),
            completedAt: new Date('2024-01-02'),
          }),
        ],
      });

      prismaMock.dCAStrategy.findFirst.mockResolvedValue(mockStrategy as any);
      
      mockPriceService.getTokenPrice
        .mockResolvedValueOnce(1) // USDC
        .mockResolvedValueOnce(2200); // ETH current price

      const result = await dcaService.getStrategyAnalytics('dca_test123', 'user_test123');

      expect(result).not.toBeNull();
      expect(result!.executionHistory).toHaveLength(2);
      expect(result!.averagePrice).toBe(2000);
      expect(result!.currentPrice).toBeGreaterThan(0);
    });

    it('should return null for nonexistent strategy', async () => {
      prismaMock.dCAStrategy.findFirst.mockResolvedValue(null);

      const result = await dcaService.getStrategyAnalytics('nonexistent', 'user_test123');

      expect(result).toBeNull();
    });
  });
});
