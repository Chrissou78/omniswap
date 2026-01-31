import { Prisma } from '@prisma/client';
import { AlertService } from '../../services/alert.service';
import { prismaMock, redisMock } from '../setup';
import {
  createMockPriceAlert,
  createMockAlertHistory,
  createMockPriceService,
  createMockNotificationService,
  createMockQueue,
} from '../utils/test-helpers';

describe('AlertService', () => {
  let alertService: AlertService;
  let mockPriceService: ReturnType<typeof createMockPriceService>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockPriceService = createMockPriceService();
    mockNotificationService = createMockNotificationService();
    mockQueue = createMockQueue();

    alertService = new AlertService(
      prismaMock as any,
      redisMock as any,
      mockPriceService as any,
      mockNotificationService as any,
      mockQueue as any
    );
  });

  // ==========================================================================
  // createAlert Tests
  // ==========================================================================

  describe('createAlert', () => {
    it('should create a price above alert successfully', async () => {
      const mockAlert = createMockPriceAlert();
      
      mockPriceService.getTokenPrice.mockResolvedValue(100);
      prismaMock.priceAlert.findFirst.mockResolvedValue(null);
      prismaMock.priceAlert.create.mockResolvedValue(mockAlert as any);
      redisMock.del.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);
      redisMock.setex.mockResolvedValue('OK');

      const result = await alertService.createAlert({
        userId: 'user_test123',
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
      });

      expect(result.id).toBe('alert_test123');
      expect(prismaMock.priceAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_test123',
          alertType: 'ABOVE',
          targetPrice: expect.any(Prisma.Decimal),
        }),
      });
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should create a price below alert successfully', async () => {
      const mockAlert = createMockPriceAlert({ alertType: 'BELOW', targetPrice: new Prisma.Decimal(80) });
      
      mockPriceService.getTokenPrice.mockResolvedValue(100);
      prismaMock.priceAlert.findFirst.mockResolvedValue(null);
      prismaMock.priceAlert.create.mockResolvedValue(mockAlert as any);
      redisMock.del.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);
      redisMock.setex.mockResolvedValue('OK');

      const result = await alertService.createAlert({
        userId: 'user_test123',
        tokenAddress: '0xtoken123',
        tokenSymbol: 'TEST',
        tokenName: 'Test Token',
        chainId: 1,
        alertType: 'below',
        targetPrice: 80,
        notifyEmail: true,
        notifyPush: false,
        notifyTelegram: false,
        isRecurring: false,
        cooldownMinutes: 0,
      });

      expect(prismaMock.priceAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertType: 'BELOW',
        }),
      });
    });

    it('should create a percent change alert successfully', async () => {
      const mockAlert = createMockPriceAlert({
        alertType: 'PERCENT_CHANGE',
        targetPrice: null,
        targetPercentChange: new Prisma.Decimal(10),
      });
      
      mockPriceService.getTokenPrice.mockResolvedValue(100);
      prismaMock.priceAlert.findFirst.mockResolvedValue(null);
      prismaMock.priceAlert.create.mockResolvedValue(mockAlert as any);
      redisMock.del.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);
      redisMock.setex.mockResolvedValue('OK');

      const result = await alertService.createAlert({
        userId: 'user_test123',
        tokenAddress: '0xtoken123',
        tokenSymbol: 'TEST',
        tokenName: 'Test Token',
        chainId: 1,
        alertType: 'percent_change',
        targetPercentChange: 10,
        notifyEmail: true,
        notifyPush: true,
        notifyTelegram: false,
        isRecurring: false,
        cooldownMinutes: 0,
      });

      expect(prismaMock.priceAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertType: 'PERCENT_CHANGE',
          targetPercentChange: expect.any(Prisma.Decimal),
        }),
      });
    });

    it('should throw error if price cannot be fetched', async () => {
      mockPriceService.getTokenPrice.mockResolvedValue(null);

      await expect(
        alertService.createAlert({
          userId: 'user_test123',
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
      ).rejects.toThrow('Unable to fetch current token price');
    });

    it('should throw error for duplicate alert', async () => {
      mockPriceService.getTokenPrice.mockResolvedValue(100);
      prismaMock.priceAlert.findFirst.mockResolvedValue(createMockPriceAlert() as any);

      await expect(
        alertService.createAlert({
          userId: 'user_test123',
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
      ).rejects.toThrow('A similar alert already exists');
    });

    it('should throw error if percent_change alert missing targetPercentChange', async () => {
      mockPriceService.getTokenPrice.mockResolvedValue(100);

      await expect(
        alertService.createAlert({
          userId: 'user_test123',
          tokenAddress: '0xtoken123',
          tokenSymbol: 'TEST',
          tokenName: 'Test Token',
          chainId: 1,
          alertType: 'percent_change',
          notifyEmail: true,
          notifyPush: true,
          notifyTelegram: false,
          isRecurring: false,
          cooldownMinutes: 0,
        })
      ).rejects.toThrow('targetPercentChange is required');
    });
  });

  // ==========================================================================
  // updateAlert Tests
  // ==========================================================================

  describe('updateAlert', () => {
    it('should update alert successfully', async () => {
      const mockAlert = createMockPriceAlert();
      
      prismaMock.priceAlert.findFirst.mockResolvedValue(mockAlert as any);
      prismaMock.priceAlert.update.mockResolvedValue({
        ...mockAlert,
        targetPrice: new Prisma.Decimal(200),
      } as any);
      redisMock.del.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);
      redisMock.setex.mockResolvedValue('OK');
      mockPriceService.getTokenPrice.mockResolvedValue(100);

      const result = await alertService.updateAlert('alert_test123', 'user_test123', {
        targetPrice: 200,
      });

      expect(prismaMock.priceAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert_test123' },
        data: expect.objectContaining({
          targetPrice: expect.any(Prisma.Decimal),
        }),
      });
    });

    it('should throw error if alert not found', async () => {
      prismaMock.priceAlert.findFirst.mockResolvedValue(null);

      await expect(
        alertService.updateAlert('nonexistent', 'user_test123', { isEnabled: false })
      ).rejects.toThrow('Alert not found');
    });

    it('should toggle alert enabled status', async () => {
      const mockAlert = createMockPriceAlert();
      
      prismaMock.priceAlert.findFirst.mockResolvedValue(mockAlert as any);
      prismaMock.priceAlert.update.mockResolvedValue({
        ...mockAlert,
        isEnabled: false,
      } as any);
      redisMock.del.mockResolvedValue(1);
      redisMock.get.mockResolvedValue(null);
      redisMock.setex.mockResolvedValue('OK');
      mockPriceService.getTokenPrice.mockResolvedValue(100);

      await alertService.updateAlert('alert_test123', 'user_test123', {
        isEnabled: false,
      });

      expect(prismaMock.priceAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert_test123' },
        data: expect.objectContaining({
          isEnabled: false,
        }),
      });
    });
  });

  // ==========================================================================
  // deleteAlert Tests
  // ==========================================================================

  describe('deleteAlert', () => {
    it('should delete alert successfully', async () => {
      const mockAlert = createMockPriceAlert();
      
      prismaMock.priceAlert.findFirst.mockResolvedValue(mockAlert as any);
      prismaMock.priceAlert.delete.mockResolvedValue(mockAlert as any);
      redisMock.del.mockResolvedValue(1);

      await alertService.deleteAlert('alert_test123', 'user_test123');

      expect(prismaMock.priceAlert.delete).toHaveBeenCalledWith({
        where: { id: 'alert_test123' },
      });
    });

    it('should throw error if alert not found', async () => {
      prismaMock.priceAlert.findFirst.mockResolvedValue(null);

      await expect(
        alertService.deleteAlert('nonexistent', 'user_test123')
      ).rejects.toThrow('Alert not found');
    });
  });

  // ==========================================================================
  // getAlertStats Tests
  // ==========================================================================

  describe('getAlertStats', () => {
    it('should return stats from cache if available', async () => {
      const cachedStats = {
        totalAlerts: 10,
        activeAlerts: 5,
        triggeredToday: 2,
        triggeredTotal: 50,
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cachedStats));

      const result = await alertService.getAlertStats('user_test123');

      expect(result).toEqual(cachedStats);
      expect(prismaMock.priceAlert.count).not.toHaveBeenCalled();
    });

    it('should calculate and cache stats if not in cache', async () => {
      redisMock.get.mockResolvedValue(null);
      redisMock.setex.mockResolvedValue('OK');
      
      prismaMock.priceAlert.count
        .mockResolvedValueOnce(10) // totalAlerts
        .mockResolvedValueOnce(5); // activeAlerts
      prismaMock.alertHistory.count
        .mockResolvedValueOnce(2) // triggeredToday
        .mockResolvedValueOnce(50); // triggeredTotal

      const result = await alertService.getAlertStats('user_test123');

      expect(result).toEqual({
        totalAlerts: 10,
        activeAlerts: 5,
        triggeredToday: 2,
        triggeredTotal: 50,
      });
      expect(redisMock.setex).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // checkAlert Tests
  // ==========================================================================

  describe('checkAlert', () => {
    it('should trigger alert when price goes above target', async () => {
      const mockAlert = createMockPriceAlert({
        alertType: 'ABOVE',
        targetPrice: new Prisma.Decimal(150),
        isEnabled: true,
      });

      prismaMock.priceAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        user: { id: 'user_test123', email: 'test@example.com' },
      } as any);
      mockPriceService.getTokenPrice.mockResolvedValue(160); // Above target
      prismaMock.priceAlert.update.mockResolvedValue(mockAlert as any);
      prismaMock.alertHistory.create.mockResolvedValue(createMockAlertHistory() as any);
      redisMock.del.mockResolvedValue(1);

      const result = await alertService.checkAlert('alert_test123');

      expect(result).toBe(true);
      expect(mockNotificationService.sendEmailAlert).toHaveBeenCalled();
      expect(mockNotificationService.sendPushAlert).toHaveBeenCalled();
      expect(prismaMock.alertHistory.create).toHaveBeenCalled();
    });

    it('should trigger alert when price goes below target', async () => {
      const mockAlert = createMockPriceAlert({
        alertType: 'BELOW',
        targetPrice: new Prisma.Decimal(80),
        isEnabled: true,
      });

      prismaMock.priceAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        user: { id: 'user_test123', email: 'test@example.com' },
      } as any);
      mockPriceService.getTokenPrice.mockResolvedValue(70); // Below target
      prismaMock.priceAlert.update.mockResolvedValue(mockAlert as any);
      prismaMock.alertHistory.create.mockResolvedValue(createMockAlertHistory() as any);
      redisMock.del.mockResolvedValue(1);

      const result = await alertService.checkAlert('alert_test123');

      expect(result).toBe(true);
    });

    it('should not trigger alert when price does not meet condition', async () => {
      const mockAlert = createMockPriceAlert({
        alertType: 'ABOVE',
        targetPrice: new Prisma.Decimal(150),
        isEnabled: true,
      });

      prismaMock.priceAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        user: { id: 'user_test123' },
      } as any);
      mockPriceService.getTokenPrice.mockResolvedValue(100); // Below target
      prismaMock.priceAlert.update.mockResolvedValue(mockAlert as any);

      const result = await alertService.checkAlert('alert_test123');

      expect(result).toBe(false);
      expect(mockNotificationService.sendEmailAlert).not.toHaveBeenCalled();
    });

    it('should respect cooldown for recurring alerts', async () => {
      const mockAlert = createMockPriceAlert({
        alertType: 'ABOVE',
        targetPrice: new Prisma.Decimal(150),
        isEnabled: true,
        isRecurring: true,
        cooldownMinutes: 60,
        lastTriggeredAt: new Date(), // Just triggered
      });

      prismaMock.priceAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        user: { id: 'user_test123' },
      } as any);

      const result = await alertService.checkAlert('alert_test123');

      expect(result).toBe(false);
    });

    it('should return false for disabled alert', async () => {
      const mockAlert = createMockPriceAlert({ isEnabled: false });

      prismaMock.priceAlert.findUnique.mockResolvedValue(mockAlert as any);

      const result = await alertService.checkAlert('alert_test123');

      expect(result).toBe(false);
    });

    it('should return false for nonexistent alert', async () => {
      prismaMock.priceAlert.findUnique.mockResolvedValue(null);

      const result = await alertService.checkAlert('nonexistent');

      expect(result).toBe(false);
    });

    it('should disable non-recurring alert after trigger', async () => {
      const mockAlert = createMockPriceAlert({
        alertType: 'ABOVE',
        targetPrice: new Prisma.Decimal(150),
        isEnabled: true,
        isRecurring: false,
      });

      prismaMock.priceAlert.findUnique.mockResolvedValue({
        ...mockAlert,
        user: { id: 'user_test123', email: 'test@example.com' },
      } as any);
      mockPriceService.getTokenPrice.mockResolvedValue(160);
      prismaMock.priceAlert.update.mockResolvedValue(mockAlert as any);
      prismaMock.alertHistory.create.mockResolvedValue(createMockAlertHistory() as any);
      redisMock.del.mockResolvedValue(1);

      await alertService.checkAlert('alert_test123');

      expect(prismaMock.priceAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert_test123' },
        data: expect.objectContaining({
          isEnabled: false,
        }),
      });
    });
  });

  // ==========================================================================
  // getAlertHistory Tests
  // ==========================================================================

  describe('getAlertHistory', () => {
    it('should return alert history', async () => {
      const mockHistory = [
        createMockAlertHistory({ id: 'history_1' }),
        createMockAlertHistory({ id: 'history_2' }),
      ];

      prismaMock.alertHistory.findMany.mockResolvedValue(mockHistory as any);

      const result = await alertService.getAlertHistory('user_test123', 50, 0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('history_1');
    });

    it('should respect limit and offset', async () => {
      prismaMock.alertHistory.findMany.mockResolvedValue([]);

      await alertService.getAlertHistory('user_test123', 10, 20);

      expect(prismaMock.alertHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });
});
