// packages/core/src/utils/queue.ts

import { Queue, Worker, Job } from 'bullmq';

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
  payload: unknown;
  attempt: number;
}

export class QueueManager {
  private queues: Map<string, Queue<unknown, unknown, string>> = new Map();
  private workers: Map<string, Worker<unknown, unknown, string>> = new Map();
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  getQueue(name: string): Queue<unknown, unknown, string> {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.config.redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 50,
          ...this.config.defaultJobOptions,
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<unknown>,
    options?: { concurrency?: number; limiter?: { max: number; duration: number } }
  ): Worker {
    const worker = new Worker(queueName, processor, {
      connection: this.config.redis,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
    });

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

  async addJob<T>(
    queueName: string,
    data: T,
    options?: {
      jobId?: string;
      delay?: number;
      priority?: number;
      repeat?: { pattern?: string; every?: number };
    }
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    return queue.add(queueName, data as unknown, options);
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async close(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}

export const QUEUES = {
  SWAP_EXECUTION: 'swap-execution',
  TRANSACTION_MONITOR: 'transaction-monitor',
  TOKEN_SYNC: 'token-sync',
  WEBHOOKS: 'webhooks',
  PRICE_UPDATE: 'price-update',
} as const;
