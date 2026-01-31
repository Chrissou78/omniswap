import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { DCAService } from '@omniswap/core/services/dca.service';
import { logger } from '../utils/logger';

interface DCAJob {
  strategyId: string;
  executionNumber: number;
}

export function createDCAWorker(
  redis: Redis,
  dcaService: DCAService
): Worker {
  const worker = new Worker<DCAJob>(
    'dca-execution',
    async (job: Job<DCAJob>) => {
      const { strategyId, executionNumber } = job.data;

      try {
        await dcaService.executeStrategy(strategyId, executionNumber);
        return { strategyId, executionNumber, success: true };
      } catch (error) {
        logger.error('DCA execution job failed', { strategyId, executionNumber, error });
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info('DCA execution job completed', {
      jobId: job.id,
      strategyId: job.data.strategyId,
      executionNumber: job.data.executionNumber,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('DCA execution job failed', {
      jobId: job?.id,
      strategyId: job?.data.strategyId,
      error: err.message,
    });
  });

  return worker;
}
