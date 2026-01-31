// packages/core/src/executors/index.ts

import { BaseExecutor, ExecutionContext, ExecutionResult, TransactionStatus } from './base.executor';
import { EVMExecutor } from './evm.executor';
import { SolanaExecutor } from './solana.executor';
import { SuiExecutor } from './sui.executor';
import { CEXExecutor } from './cex.executor';

export class ExecutorRegistry {
  private executors: Map<string, BaseExecutor> = new Map();

  constructor() {
    // Initialize all executors
    this.executors.set('EVM', new EVMExecutor());
    this.executors.set('SOLANA', new SolanaExecutor());
    this.executors.set('SUI', new SuiExecutor());
    this.executors.set('CEX', new CEXExecutor());
  }

  /**
   * Get executor for a chain
   */
  getExecutorForChain(chainId: string): BaseExecutor | null {
    // Check EVM chains
    const evmExecutor = this.executors.get('EVM');
    if (evmExecutor?.supportsChain(chainId)) {
      return evmExecutor;
    }

    // Check Solana
    const solanaExecutor = this.executors.get('SOLANA');
    if (solanaExecutor?.supportsChain(chainId)) {
      return solanaExecutor;
    }

    // Check Sui
    const suiExecutor = this.executors.get('SUI');
    if (suiExecutor?.supportsChain(chainId)) {
      return suiExecutor;
    }

    // Check CEX
    const cexExecutor = this.executors.get('CEX');
    if (chainId.startsWith('cex:') || chainId === 'mexc') {
      return cexExecutor;
    }

    return null;
  }

  /**
   * Get executor by type
   */
  getExecutor(type: 'EVM' | 'SOLANA' | 'SUI' | 'CEX'): BaseExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`Executor not found for type: ${type}`);
    }
    return executor;
  }

  /**
   * Execute a swap step
   */
  async executeStep(context: ExecutionContext): Promise<ExecutionResult> {
    const executor = this.getExecutorForChain(context.step.chainId);
    if (!executor) {
      return {
        success: false,
        error: `No executor for chain: ${context.step.chainId}`,
      };
    }
    return executor.executeTransaction(context);
  }

  /**
   * Get transaction status
   */
  async getStatus(chainId: string, txHash: string): Promise<TransactionStatus> {
    const executor = this.getExecutorForChain(chainId);
    if (!executor) {
      return {
        status: 'FAILED',
        error: `No executor for chain: ${chainId}`,
      };
    }
    return executor.getTransactionStatus(chainId, txHash);
  }
}

// Export all
export { BaseExecutor, ExecutionContext, ExecutionResult, TransactionStatus } from './base.executor';
export { EVMExecutor } from './evm.executor';
export { SolanaExecutor } from './solana.executor';
export { SuiExecutor } from './sui.executor';
export { CEXExecutor } from './cex.executor';
