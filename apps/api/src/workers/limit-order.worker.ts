import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { LimitOrderService } from '@omniswap/core/services/limit-order.service';
import { logger } from '../utils/logger';

interface LimitOrderJob {
  orderId?: string;
  checkAll?: boolean;
}

export function createLimitOrderWorker(
  redis: Redis,
  limitOrderService: LimitOrderService
): Worker {
  const worker = new Worker<LimitOrderJob>(
    'limit-order-check',
    async (job: Job<LimitOrderJob>) => {
      const { orderId, checkAll } = job.data;

      try {
        if (checkAll) {
          const result = await limitOrderService.checkAllPendingOrders();
          logger.info('Limit order bulk check completed', result);
          return result;
        } else if (orderId) {
          const result = await limitOrderService.checkOrder(orderId);
          return result;
        }
      } catch (error) {
        logger.error('Limit order check job failed', { orderId, checkAll, error });
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Limit order check job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Limit order check job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}
