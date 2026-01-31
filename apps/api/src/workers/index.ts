// apps/api/src/workers/index.ts

import { QueueManager, QUEUES, SwapJob, TransactionMonitorJob, TokenSyncJob } from '../utils/queue';
import { SwapService, TransactionMonitorService, TokenRegistryService } from '@omniswap/core';

export function setupWorkers(
  queueManager: QueueManager,
  services: {
    swapService: SwapService;
    monitorService: TransactionMonitorService;
    tokenRegistryService: TokenRegistryService;
  }
): void {
  // Swap Execution Worker
  queueManager.createWorker<SwapJob>(
    QUEUES.SWAP_EXECUTION,
    async (job) => {
      const { swapId, quoteId, routeId, userAddress, tenantId } = job.data;
      
      console.log(`[Worker] Processing swap: ${swapId}`);
      
      // Swap execution is handled via API (user signs transactions)
      // This worker handles background tasks like notifications
      
      return { processed: true };
    },
    { concurrency: 10 }
  );

  // Transaction Monitor Worker
  queueManager.createWorker<TransactionMonitorJob>(
    QUEUES.TRANSACTION_MONITOR,
    async (job) => {
      const { swapId, stepIndex, chainId, txHash, type } = job.data;
      
      console.log(`[Worker] Monitoring transaction: ${txHash}`);
      
      await services.monitorService.addTransaction(
        swapId,
        stepIndex,
        chainId,
        txHash,
        type
      );
      
      return { monitoring: true };
    },
    { concurrency: 20 }
  );

  // Token Sync Worker
  queueManager.createWorker<TokenSyncJob>(
    QUEUES.TOKEN_SYNC,
    async (job) => {
      const { source, chainId } = job.data;
      
      console.log(`[Worker] Syncing tokens from: ${source}`);
      
      switch (source) {
        case 'oneinch':
          await services.tokenRegistryService.syncFromOneInch();
          break;
        case 'jupiter':
          await services.tokenRegistryService.syncFromJupiter();
          break;
        case 'cetus':
          await services.tokenRegistryService.syncFromCetus();
          break;
        default:
          await services.tokenRegistryService.syncAll();
      }
      
      return { synced: true };
    },
    { concurrency: 1 }
  );

  console.log('[Workers] All workers initialized');
}

// Schedule recurring token sync
export function scheduleTokenSync(queueManager: QueueManager): void {
  const queue = queueManager.getQueue<TokenSyncJob>(QUEUES.TOKEN_SYNC);
  
  // Sync every 6 hours
  queue.add(
    QUEUES.TOKEN_SYNC,
    { source: 'oneinch' },
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      jobId: 'sync-oneinch',
    }
  );
  
  queue.add(
    QUEUES.TOKEN_SYNC,
    { source: 'jupiter' },
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      jobId: 'sync-jupiter',
    }
  );
  
  queue.add(
    QUEUES.TOKEN_SYNC,
    { source: 'cetus' },
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      jobId: 'sync-cetus',
    }
  );

  console.log('[Workers] Token sync scheduled');
}
