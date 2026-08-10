// apps/web/src/lib/paymentVerification.ts
//
// Server-side verification that a claimed payment actually happened on-chain
// (or in Stripe) for the expected amount, token, and recipient.
//
// SECURITY: every constant that defines "what a valid payment looks like"
// (accepted stablecoin contract addresses, decimals, and our own receiving
// wallets) is defined HERE, server-side. The client sends only a tx hash and
// which chain/token it claims to have used - it never gets to tell us the
// recipient or the token contract, otherwise an attacker could "verify" a
// payment they made to their own address.

import { createPublicClient, http, getAddress, type Address } from 'viem';
import { Connection, PublicKey } from '@solana/web3.js';
import { SuiClient } from '@mysten/sui/client';
import Stripe from 'stripe';
import { getChainRpc } from '@/lib/chain-config';

export interface VerificationResult {
  verified: boolean;
  reason?: string;
}

/** Accepted stablecoin contracts per chain, server-side source of truth. */
const ACCEPTED_TOKENS: Record<string, Partial<Record<'usdc' | 'usdt', string>>> = {
  '1': { usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  '56': { usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', usdt: '0x55d398326f99059fF775485246999027B3197955' },
  '137': { usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
  '42161': { usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
  '10': { usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
  '8453': { usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  '43114': { usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', usdt: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
  'solana-mainnet': { usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  'sui-mainnet': { usdc: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN' },
};

/** All supported stablecoins here use 6 decimals. */
const TOKEN_DECIMALS = 6;

/**
 * Allow a small shortfall so a payment isn't rejected over floating-point dust
 * in the client's amount calculation. 1 cent of a 6-decimal stablecoin.
 */
const AMOUNT_TOLERANCE = 10_000n;

/** keccak256("Transfer(address,address,uint256)") */
const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function getExpectedRecipient(chainType: 'evm' | 'solana' | 'sui'): string | null {
  const wallets = {
    evm: process.env.NEXT_PUBLIC_PAYMENT_WALLET_EVM,
    solana: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SOLANA,
    sui: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SUI,
  };
  return wallets[chainType] || null;
}

function toSmallestUnit(amountUsd: number): bigint {
  // Round to avoid float artifacts, e.g. 12.3 * 1e6 -> 12299999.999
  return BigInt(Math.round(amountUsd * 10 ** TOKEN_DECIMALS));
}

function getAcceptedTokenAddress(chainId: string, token: string): string | null {
  const normalized = token.toLowerCase();
  if (normalized !== 'usdc' && normalized !== 'usdt') return null;
  return ACCEPTED_TOKENS[chainId]?.[normalized] ?? null;
}

/**
 * Verify an EVM ERC-20 stablecoin payment: the tx must be confirmed and contain
 * a Transfer log from the expected token contract, to our wallet, for >= the
 * expected amount.
 */
export async function verifyEvmPayment(params: {
  txHash: string;
  chainId: string;
  token: string;
  expectedAmountUsd: number;
}): Promise<VerificationResult> {
  const { txHash, chainId, token, expectedAmountUsd } = params;

  const tokenAddress = getAcceptedTokenAddress(chainId, token);
  if (!tokenAddress) {
    return { verified: false, reason: `Unsupported token ${token} on chain ${chainId}` };
  }

  const recipient = getExpectedRecipient('evm');
  if (!recipient) {
    return { verified: false, reason: 'Payment wallet not configured on the server' };
  }

  const rpcUrl = getChainRpc(chainId);
  if (!rpcUrl) {
    return { verified: false, reason: `No RPC configured for chain ${chainId}` };
  }

  try {
    const client = createPublicClient({ transport: http(rpcUrl) });
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (receipt.status !== 'success') {
      return { verified: false, reason: 'Transaction reverted on-chain' };
    }

    const expectedAmount = toSmallestUnit(expectedAmountUsd);
    const expectedToken = getAddress(tokenAddress);
    const expectedTo = getAddress(recipient);

    // Sum all matching Transfer logs to our wallet from the expected token,
    // in case the payment arrived split across multiple transfers.
    let received = 0n;
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== expectedToken) continue;

      // Decode from topics: topic0 = event signature, topic2 = indexed `to`
      const [topic0, , topicTo] = log.topics;
      if (!topic0 || !topicTo) continue;

      if (topic0.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;

      const logTo = getAddress(`0x${topicTo.slice(-40)}` as Address);
      if (logTo !== expectedTo) continue;

      received += BigInt(log.data);
    }

    if (received === 0n) {
      return {
        verified: false,
        reason: 'No matching token transfer to the payment wallet found in this transaction',
      };
    }

    if (received + AMOUNT_TOLERANCE < expectedAmount) {
      return {
        verified: false,
        reason: `Underpaid: received ${received} but expected ${expectedAmount} (smallest units)`,
      };
    }

    return { verified: true };
  } catch (error: any) {
    // A network failure is NOT a pass - fail closed.
    return { verified: false, reason: `Could not verify transaction: ${error?.message || 'RPC error'}` };
  }
}

/**
 * Verify a Solana SPL stablecoin payment by comparing pre/post token balances
 * for our recipient's account in the confirmed transaction.
 */
export async function verifySolanaPayment(params: {
  txHash: string;
  token: string;
  expectedAmountUsd: number;
}): Promise<VerificationResult> {
  const { txHash, token, expectedAmountUsd } = params;

  const mint = getAcceptedTokenAddress('solana-mainnet', token);
  if (!mint) {
    return { verified: false, reason: `Unsupported token ${token} on Solana` };
  }

  const recipient = getExpectedRecipient('solana');
  if (!recipient) {
    return { verified: false, reason: 'Payment wallet not configured on the server' };
  }

  const rpcUrl = getChainRpc('solana-mainnet') || 'https://api.mainnet-beta.solana.com';

  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const tx = await connection.getTransaction(txHash, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { verified: false, reason: 'Transaction not found on Solana' };
    }
    if (tx.meta?.err) {
      return { verified: false, reason: 'Transaction failed on-chain' };
    }

    const recipientKey = new PublicKey(recipient).toBase58();
    const pre = tx.meta?.preTokenBalances || [];
    const post = tx.meta?.postTokenBalances || [];

    // Find the balance delta for our recipient's account holding this mint.
    let delta = 0n;
    for (const postBal of post) {
      if (postBal.mint !== mint) continue;
      if (postBal.owner !== recipientKey) continue;

      const preBal = pre.find(
        (p) => p.accountIndex === postBal.accountIndex && p.mint === postBal.mint
      );
      const postAmount = BigInt(postBal.uiTokenAmount.amount);
      const preAmount = preBal ? BigInt(preBal.uiTokenAmount.amount) : 0n;
      delta += postAmount - preAmount;
    }

    if (delta <= 0n) {
      return {
        verified: false,
        reason: 'No incoming token transfer to the payment wallet found in this transaction',
      };
    }

    const expectedAmount = toSmallestUnit(expectedAmountUsd);
    if (delta + AMOUNT_TOLERANCE < expectedAmount) {
      return {
        verified: false,
        reason: `Underpaid: received ${delta} but expected ${expectedAmount} (smallest units)`,
      };
    }

    return { verified: true };
  } catch (error: any) {
    return { verified: false, reason: `Could not verify transaction: ${error?.message || 'RPC error'}` };
  }
}

/**
 * Verify a Sui coin payment via the transaction's balance changes.
 */
export async function verifySuiPayment(params: {
  txHash: string;
  token: string;
  expectedAmountUsd: number;
}): Promise<VerificationResult> {
  const { txHash, token, expectedAmountUsd } = params;

  const coinType = getAcceptedTokenAddress('sui-mainnet', token);
  if (!coinType) {
    return { verified: false, reason: `Unsupported token ${token} on Sui` };
  }

  const recipient = getExpectedRecipient('sui');
  if (!recipient) {
    return { verified: false, reason: 'Payment wallet not configured on the server' };
  }

  const rpcUrl = getChainRpc('sui-mainnet') || 'https://fullnode.mainnet.sui.io';

  try {
    const client = new SuiClient({ url: rpcUrl });
    const tx = await client.getTransactionBlock({
      digest: txHash,
      options: { showBalanceChanges: true, showEffects: true },
    });

    if (tx.effects?.status?.status !== 'success') {
      return { verified: false, reason: 'Transaction failed on-chain' };
    }

    const normalizedRecipient = recipient.toLowerCase();
    let delta = 0n;

    for (const change of tx.balanceChanges || []) {
      if (change.coinType !== coinType) continue;
      const ownerAddress =
        typeof change.owner === 'object' && change.owner !== null && 'AddressOwner' in change.owner
          ? (change.owner as { AddressOwner: string }).AddressOwner
          : null;
      if (!ownerAddress || ownerAddress.toLowerCase() !== normalizedRecipient) continue;
      delta += BigInt(change.amount);
    }

    if (delta <= 0n) {
      return {
        verified: false,
        reason: 'No incoming coin transfer to the payment wallet found in this transaction',
      };
    }

    const expectedAmount = toSmallestUnit(expectedAmountUsd);
    if (delta + AMOUNT_TOLERANCE < expectedAmount) {
      return {
        verified: false,
        reason: `Underpaid: received ${delta} but expected ${expectedAmount} (smallest units)`,
      };
    }

    return { verified: true };
  } catch (error: any) {
    return { verified: false, reason: `Could not verify transaction: ${error?.message || 'RPC error'}` };
  }
}

/**
 * Verify a Stripe Checkout Session was actually paid, by asking Stripe directly
 * rather than trusting the client's redirect.
 */
export async function verifyStripeSession(params: {
  sessionId: string;
  expectedAmountUsd: number;
}): Promise<VerificationResult> {
  const { sessionId, expectedAmountUsd } = params;

  if (!process.env.STRIPE_SECRET_KEY) {
    return { verified: false, reason: 'Stripe is not configured on the server' };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { verified: false, reason: `Stripe payment status is "${session.payment_status}"` };
    }

    // Stripe amounts are in cents.
    const expectedCents = Math.round(expectedAmountUsd * 100);
    if ((session.amount_total ?? 0) + 1 < expectedCents) {
      return {
        verified: false,
        reason: `Underpaid: Stripe recorded ${session.amount_total} cents but expected ${expectedCents}`,
      };
    }

    return { verified: true };
  } catch (error: any) {
    return { verified: false, reason: `Could not verify Stripe session: ${error?.message || 'API error'}` };
  }
}

/**
 * Dispatch to the right verifier based on what the client claims it paid with.
 * `chainId` of 'stripe' means a Stripe Checkout Session id was supplied.
 */
export async function verifyPayment(params: {
  txHash: string;
  chainId: string;
  token: string;
  expectedAmountUsd: number;
}): Promise<VerificationResult> {
  const { txHash, chainId, token, expectedAmountUsd } = params;

  if (!txHash) return { verified: false, reason: 'Missing payment reference' };

  if (chainId === 'stripe') {
    return verifyStripeSession({ sessionId: txHash, expectedAmountUsd });
  }
  if (chainId === 'solana-mainnet') {
    return verifySolanaPayment({ txHash, token, expectedAmountUsd });
  }
  if (chainId === 'sui-mainnet') {
    return verifySuiPayment({ txHash, token, expectedAmountUsd });
  }
  return verifyEvmPayment({ txHash, chainId, token, expectedAmountUsd });
}
