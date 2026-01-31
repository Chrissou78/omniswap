// packages/core/src/executors/solana.executor.ts

import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionSignature,
  Commitment,
} from '@solana/web3.js';
import {
  BaseExecutor,
  ExecutionContext,
  ExecutionResult,
  TransactionStatus,
} from './base.executor';

const SOLANA_RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
];

export class SolanaExecutor extends BaseExecutor {
  readonly chainType = 'SOLANA' as const;
  readonly supportedChains = ['solana'];

  private connection: Connection;

  constructor(rpcUrl?: string) {
    super();
    this.connection = new Connection(
      rpcUrl || SOLANA_RPC_URLS[0],
      'confirmed'
    );
  }

  async prepareTransaction(context: ExecutionContext): Promise<{
    to: string;
    data: string;
    value: string;
    serializedTransaction?: string;
  }> {
    const { step } = context;

    // Jupiter returns base64 encoded transaction
    if (!step.txData) {
      throw new Error('Transaction data not available');
    }

    return {
      to: '',
      data: '',
      value: '0',
      serializedTransaction: step.txData,
    };
  }

  async executeTransaction(context: ExecutionContext): Promise<ExecutionResult> {
    const { signedTransaction } = context;

    if (!signedTransaction) {
      return {
        success: false,
        error: 'No signed transaction provided',
      };
    }

    try {
      // Decode the signed transaction
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      
      // Try to parse as versioned transaction first
      let signature: TransactionSignature;
      
      try {
        const versionedTx = VersionedTransaction.deserialize(txBuffer);
        signature = await this.connection.sendTransaction(versionedTx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } catch {
        // Fall back to legacy transaction
        const legacyTx = Transaction.from(txBuffer);
        signature = await this.connection.sendRawTransaction(txBuffer, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      }

      console.log(`[Solana] Transaction sent: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        signature,
        'confirmed'
      );

      if (confirmation.value.err) {
        return {
          success: false,
          txHash: signature,
          error: JSON.stringify(confirmation.value.err),
        };
      }

      // Get transaction details for block number
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      return {
        success: true,
        txHash: signature,
        blockNumber: txDetails?.slot,
      };
    } catch (error: any) {
      console.error(`[Solana] Transaction failed:`, error);
      return {
        success: false,
        error: error.message || 'Transaction failed',
      };
    }
  }

  async getTransactionStatus(
    chainId: string,
    txHash: string
  ): Promise<TransactionStatus> {
    try {
      const signature = txHash as TransactionSignature;
      
      // Get transaction status
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      if (!status.value) {
        return {
          status: 'PENDING',
        };
      }

      const { confirmationStatus, err, slot } = status.value;

      if (err) {
        return {
          status: 'FAILED',
          error: JSON.stringify(err),
          blockNumber: slot,
        };
      }

      if (confirmationStatus === 'finalized') {
        return {
          status: 'CONFIRMED',
          confirmations: 32,
          requiredConfirmations: 32,
          blockNumber: slot,
        };
      }

      if (confirmationStatus === 'confirmed') {
        return {
          status: 'CONFIRMING',
          confirmations: 1,
          requiredConfirmations: 32,
          blockNumber: slot,
        };
      }

      return {
        status: 'PENDING',
        blockNumber: slot,
      };
    } catch (error: any) {
      return {
        status: 'PENDING',
        error: error.message,
      };
    }
  }

  async estimateGas(context: ExecutionContext): Promise<string> {
    // Solana uses compute units, not gas
    // Return a reasonable default
    return '200000';
  }

  async checkAllowance(
    chainId: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    // Solana doesn't use allowances in the same way
    // Token accounts are delegated differently
    return BigInt(ethers.MaxUint256);
  }

  async buildApprovalTransaction(
    chainId: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<null> {
    // Solana handles approvals differently via token account delegation
    return null;
  }

  /**
   * Get SOL balance
   */
  async getBalance(address: string): Promise<bigint> {
    const pubkey = new PublicKey(address);
    const balance = await this.connection.getBalance(pubkey);
    return BigInt(balance);
  }

  /**
   * Get SPL token balance
   */
  async getTokenBalance(
    tokenMint: string,
    ownerAddress: string
  ): Promise<bigint> {
    try {
      const owner = new PublicKey(ownerAddress);
      const mint = new PublicKey(tokenMint);
      
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(owner, {
        mint,
      });

      if (tokenAccounts.value.length === 0) {
        return BigInt(0);
      }

      // Sum balances from all token accounts
      let totalBalance = BigInt(0);
      for (const account of tokenAccounts.value) {
        const accountInfo = await this.connection.getTokenAccountBalance(
          account.pubkey
        );
        totalBalance += BigInt(accountInfo.value.amount);
      }

      return totalBalance;
    } catch {
      return BigInt(0);
    }
  }
}

// Import ethers for MaxUint256
import { ethers } from 'ethers';
