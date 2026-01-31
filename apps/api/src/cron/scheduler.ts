import { Queue } from 'bullmq';
import cron from 'node-cron';
import { logger } from '../utils/logger';

export function startSchedulers(queues: {
  alertCheckQueue: Queue;
  limitOrderCheckQueue: Queue;
}): void {
  const { alertCheckQueue, limitOrderCheckQueue } = queues;

  // Price alerts: Check every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await alertCheckQueue.add(
        'bulk-check',
        { checkAll: true },
        { removeOnComplete: 100, removeOnFail: 50 }
      );
    } catch (error) {
      logger.error('Failed to schedule alert check', { error });
    }
  });

  // Limit orders: Check every 15 seconds
  cron.schedule('*/15 * * * * *', async () => {
    try {
      await limitOrderCheckQueue.add(
        'bulk-check',
        { checkAll: true },
        { removeOnComplete: 100, removeOnFail: 50 }
      );
    } catch (error) {
      logger.error('Failed to schedule limit order check', { error });
    }
  });

  logger.info('Schedulers started', {
    alerts: 'every 30 seconds',
    limitOrders: 'every 15 seconds',
    dca: 'scheduled per strategy',
  });
}
