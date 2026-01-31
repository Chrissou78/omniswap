import { Queue } from 'bullmq';
import cron from 'node-cron';
import { logger } from '../utils/logger';

export function startAlertScheduler(alertCheckQueue: Queue): void {
  // Check all alerts every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await alertCheckQueue.add(
        'bulk-check',
        { checkAll: true },
        {
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );
      logger.debug('Scheduled bulk alert check');
    } catch (error) {
      logger.error('Failed to schedule bulk alert check', { error });
    }
  });

  logger.info('Alert scheduler started - checking every 30 seconds');
}
