import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { AlertService } from '@omniswap/core/services/alert.service';
import { logger } from '../utils/logger';

interface AlertCheckJob {
  alertId?: string;
  checkAll?: boolean;
}

export function createAlertCheckWorker(
  redis: Redis,
  alertService: AlertService
): Worker {
  const worker = new Worker<AlertCheckJob>(
    'alert-check',
    async (job: Job<AlertCheckJob>) => {
      const { alertId, checkAll } = job.data;

      try {
        if (checkAll) {
          // Check all active alerts
          const result = await alertService.checkAllActiveAlerts();
          logger.info('Bulk alert check completed', result);
          return result;
        } else if (alertId) {
          // Check single alert
          const triggered = await alertService.checkAlert(alertId);
          return { alertId, triggered };
        }
      } catch (error) {
        logger.error('Alert check job failed', { alertId, checkAll, error });
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Alert check job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Alert check job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}
