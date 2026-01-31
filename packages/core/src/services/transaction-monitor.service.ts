// packages/core/src/services/transaction-monitor.service.ts

import { Swap, SwapStepExecution } from '@omniswap/types';
import { ExecutorRegistry, TransactionStatus } from '../executors';
import { SwapService } from './swap.service';
import { RedisClient } from '../utils/redis';
import { LiFiAdapter } from '../adapters/evm/lifi.adapter';

export interface MonitorConfig {
  executorRegistry: ExecutorRegistry;
  swapService: SwapService;
  redis: RedisClient;
  lifiAdapter?: LiFiAdapter;
  
  // Polling intervals
  evmPollInterval: number;      // ms
  solanaPollInterval: number;
  suiPollInterval: number;
  bridgePollInterval: number;
  
  // Callbacks
  onStatusChange?: (swap: Swap, stepIndex: number, status: TransactionStatus) => void;
}

interface MonitoredTransaction {
  swapId: string;
  stepIndex: number;
  chainId: string;
  txHash: string;
  type: 'EVM' | 'SOLANA' | 'SUI' | 'BRIDGE' | 'CEX';
  startedAt: number;
  lastChecked: number;
}

export class TransactionMonitorService {
  private config: MonitorConfig;
  private monitoredTxs: Map<string, MonitoredTransaction> = new Map();
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(config: MonitorConfig) {
    this.config = config;
  }

  /**
   * Start monitoring service
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start polling loops for each chain type
    this.startPollingLoop('EVM', this.config.evmPollInterval);
    this.startPollingLoop('SOLANA', this.config.solanaPollInterval);
    this.startPollingLoop('SUI', this.config.suiPollInterval);
    this.startPollingLoop('BRIDGE', this.config.bridgePollInterval);

    // Subscribe to new transactions
    this.subscribeToNewTransactions();

    console.log('[Monitor] Transaction monitoring started');
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    this.isRunning = false;

    for (const interval of this.pollIntervals.values()) {
      clearInterval(interval);
    }
    this.pollIntervals.clear();

    console.log('[Monitor] Transaction monitoring stopped');
  }

  /**
   * Add transaction to monitor
   */
  async addTransaction(
    swapId: string,
    stepIndex: number,
    chainId: string,
    txHash: string,
    type: 'EVM' | 'SOLANA' | 'SUI' | 'BRIDGE' | 'CEX'
  ): Promise<void> {
    const key = `${swapId}:${stepIndex}`;
    
    const monitored: MonitoredTransaction = {
      swapId,
      stepIndex,
      chainId,
      txHash,
      type,
      startedAt: Date.now(),
      lastChecked: 0,
    };

    this.monitoredTxs.set(key, monitored);

    // Also store in Redis for persistence
    await this.config.redis.hset(
      'monitored-transactions',
      key,
      JSON.stringify(monitored)
    );

    console.log(`[Monitor] Added ${type} transaction: ${txHash}`);
  }

  /**
   * Remove transaction from monitoring
   */
  async removeTransaction(swapId: string, stepIndex: number): Promise<void> {
    const key = `${swapId}:${stepIndex}`;
    this.monitoredTxs.delete(key);
    await this.config.redis.hdel('monitored-transactions', key);
  }

  /**
   * Start polling loop for a chain type
   */
  private startPollingLoop(type: string, interval: number): void {
    const poll = async () => {
      if (!this.isRunning) return;

      const txsToCheck = Array.from(this.monitoredTxs.values())
        .filter(tx => tx.type === type);

      for (const tx of txsToCheck) {
        try {
          await this.checkTransaction(tx);
        } catch (error) {
          console.error(`[Monitor] Error checking ${tx.txHash}:`, error);
        }
      }
    };

    // Initial check
    poll();

    // Set up interval
    const intervalId = setInterval(poll, interval);
    this.pollIntervals.set(type, intervalId);
  }

  /**
   * Check single transaction status
   */
  private async checkTransaction(tx: MonitoredTransaction): Promise<void> {
    tx.lastChecked = Date.now();

    let status: TransactionStatus;

    // For bridges, use Li.Fi status
    if (tx.type === 'BRIDGE' && this.config.lifiAdapter) {
      const lifiStatus = await this.config.lifiAdapter.getStatus(tx.txHash, tx.chainId);
      status = {
        status: lifiStatus.status === 'DONE' ? 'CONFIRMED' 
              : lifiStatus.status === 'FAILED' ? 'FAILED' 
              : 'CONFIRMING',
        destinationTxHash: lifiStatus.toTxHash,
      };
    } else {
      // Use executor to check status
      status = await this.config.executorRegistry.getStatus(tx.chainId, tx.txHash);
    }

    // Get swap
    const swap = await this.config.swapService.getSwap(tx.swapId);
    if (!swap) {
      await this.removeTransaction(tx.swapId, tx.stepIndex);
      return;
    }

    // Notify callback
    this.config.onStatusChange?.(swap, tx.stepIndex, status);

    // Update swap if status changed
    if (status.status === 'CONFIRMED') {
      await this.config.swapService.updateStepStatus(
        swap,
        tx.stepIndex,
        'CONFIRMED',
        {
          blockNumber: status.blockNumber,
        }
      );
      await this.removeTransaction(tx.swapId, tx.stepIndex);
    } else if (status.status === 'FAILED') {
      await this.config.swapService.updateStepStatus(
        swap,
        tx.stepIndex,
        'FAILED',
        {
          error: status.error,
        }
      );
      await this.removeTransaction(tx.swapId, tx.stepIndex);
    }

    // Check for timeout (30 minutes)
    if (Date.now() - tx.startedAt > 30 * 60 * 1000) {
      console.warn(`[Monitor] Transaction timeout: ${tx.txHash}`);
      await this.config.swapService.updateStepStatus(
        swap,
        tx.stepIndex,
        'FAILED',
        {
          error: 'Transaction timeout',
        }
      );
      await this.removeTransaction(tx.swapId, tx.stepIndex);
    }
  }

  /**
   * Subscribe to new transactions from Redis
   */
  private async subscribeToNewTransactions(): Promise<void> {
    await this.config.redis.subscribe('new-transaction', async (message) => {
      const { swapId, stepIndex, chainId, txHash, type } = message;
      await this.addTransaction(swapId, stepIndex, chainId, txHash, type);
    });
  }

  /**
   * Load persisted transactions on startup
   */
  async loadPersistedTransactions(): Promise<void> {
    const txs = await this.config.redis.hgetall('monitored-transactions');
    
    for (const [key, value] of Object.entries(txs)) {
      try {
        const tx = JSON.parse(value) as MonitoredTransaction;
        this.monitoredTxs.set(key, tx);
      } catch {
        // Invalid entry, remove it
        await this.config.redis.hdel('monitored-transactions', key);
      }
    }

    console.log(`[Monitor] Loaded ${this.monitoredTxs.size} persisted transactions`);
  }
}
