// apps/api/src/utils/queue.ts

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { RedisClient } from './redis';

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
  };
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

// Job Types
export interface SwapJob {
  swapId: string;
  quoteId: string;
  routeId: string;
  userAddress: string;
  tenantId: string;
}

export interface TransactionMonitorJob {
  swapId: string;
  stepIndex: number;
  chainId: string;
  txHash: string;
  type: 'EVM' | 'SOLANA' | 'SUI' | 'BRIDGE';
}

export interface TokenSyncJob {
  source: 'oneinch' | 'jupiter' | 'cetus' | 'coingecko';
  chainId?: string;
}

export interface WebhookJob {
  webhookId: string;
  url: string;
  event: string;
  payload: any;
  attempt: number;
}

// Queue Manager
export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  /**
   * Create or get a queue
   */
  getQueue<T = any>(name: string): Queue<T> {
    if (!this.queues.has(name)) {
      const queue = new Queue<T>(name, {
        connection: this.config.redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
          ...this.config.defaultJobOptions,
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name) as Queue<T>;
  }

  /**
   * Create a worker for a queue
   */
  createWorker<T = any>(
    queueName: string,
    processor: (job: Job<T>) => Promise<any>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Worker<T> {
    const worker = new Worker<T>(queueName, processor, {
      connection: this.config.redis,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
    });

    // Event handlers
    worker.on('completed', (job) => {
      console.log(`[${queueName}] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[${queueName}] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error(`[${queueName}] Worker error:`, err);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(
    queueName: string,
    data: T,
    options?: {
      jobId?: string;
      delay?: number;
      priority?: number;
      repeat?: {
        pattern?: string;
        every?: number;
      };
    }
  ): Promise<Job<T>> {
    const queue = this.getQueue<T>(queueName);
    return queue.add(queueName, data, options);
  }

  /**
   * Get job by ID
   */
  async getJob<T>(queueName: string, jobId: string): Promise<Job<T> | undefined> {
    const queue = this.getQueue<T>(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}

// Queue Names
export const QUEUES = {
  SWAP_EXECUTION: 'swap-execution',
  TRANSACTION_MONITOR: 'transaction-monitor',
  TOKEN_SYNC: 'token-sync',
  WEBHOOKS: 'webhooks',
  PRICE_UPDATE: 'price-update',
} as const;
