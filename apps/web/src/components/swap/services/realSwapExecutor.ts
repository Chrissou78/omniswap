// apps/web/src/components/swap/services/realSwapExecutor.ts
//
// Real same-chain EVM swap execution via 1inch (primary) / 0x (fallback).
// Deliberately scoped to same-chain EVM-to-EVM swaps only — cross-chain routing,
// Solana, and Sui execution are not implemented here (see SwapWidgetCore's route
// gating). Every call here hits the real aggregator API and returns genuinely
// sendable transaction data; nothing in this file fabricates a result.

import {
  createPublicClient,
  http,
  erc20Abi,
  maxUint256,
  parseUnits,
  encodeFunctionData,
  type Address,
} from 'viem';
import { getChainRpc } from '@/lib/chain-config';

export const EVM_NATIVE_SENTINEL: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export interface RealSwapTxRequest {
  to: Address;
  data: `0x${string}`;
  value: bigint;
  gas?: bigint;
}

export interface RealSwapPlanParams {
  chainId: number;
  fromTokenAddress: string; // 'native' or an ERC-20 address
  toTokenAddress: string;
  amount: string; // human-readable, e.g. "1.5"
  fromDecimals: number;
  slippagePercent: number; // e.g. 0.5 for 0.5%
  userAddress: Address;
}

export interface RealSwapPlan {
  provider: '1inch' | '0x';
  approveTx: RealSwapTxRequest | null;
  swapTx: RealSwapTxRequest;
  toAmountRaw: string; // smallest-unit string, as returned by the aggregator
}

function toApiAddress(address: string): Address {
  if (address === 'native' || address === '0x' || address === '0x0000000000000000000000000000000000000000') {
    return EVM_NATIVE_SENTINEL;
  }
  return address as Address;
}

function getPublicClient(chainId: number) {
  const rpcUrl = getChainRpc(chainId);
  if (!rpcUrl) throw new Error(`No RPC configured for chain ${chainId}`);
  return createPublicClient({ transport: http(rpcUrl) });
}

async function buildApproveTxIfNeeded(
  chainId: number,
  tokenAddress: Address,
  spender: Address,
  owner: Address,
  requiredAmount: bigint
): Promise<RealSwapTxRequest | null> {
  const publicClient = getPublicClient(chainId);
  const currentAllowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });

  if (currentAllowance >= requiredAmount) return null;

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, maxUint256],
  });

  return { to: tokenAddress, data, value: 0n };
}

async function try1inch(params: RealSwapPlanParams): Promise<RealSwapPlan | null> {
  const apiKey = process.env.NEXT_PUBLIC_1INCH_API_KEY;
  if (!apiKey) return null;

  const { chainId, fromTokenAddress, toTokenAddress, amount, fromDecimals, slippagePercent, userAddress } = params;
  const src = toApiAddress(fromTokenAddress);
  const dst = toApiAddress(toTokenAddress);
  const amountRaw = parseUnits(amount, fromDecimals).toString();
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };

  const swapUrl = new URL(`https://api.1inch.dev/swap/v6.0/${chainId}/swap`);
  swapUrl.searchParams.set('src', src);
  swapUrl.searchParams.set('dst', dst);
  swapUrl.searchParams.set('amount', amountRaw);
  swapUrl.searchParams.set('from', userAddress);
  swapUrl.searchParams.set('slippage', String(slippagePercent));
  swapUrl.searchParams.set('disableEstimate', 'true'); // we do our own allowance/approve step

  const swapRes = await fetch(swapUrl.toString(), { headers });
  if (!swapRes.ok) return null;
  const swapData = await swapRes.json();

  const swapTx: RealSwapTxRequest = {
    to: swapData.tx.to,
    data: swapData.tx.data,
    value: BigInt(swapData.tx.value ?? '0'),
    gas: swapData.tx.gas ? BigInt(swapData.tx.gas) : undefined,
  };

  let approveTx: RealSwapTxRequest | null = null;
  if (src !== EVM_NATIVE_SENTINEL) {
    const spenderRes = await fetch(`https://api.1inch.dev/swap/v6.0/${chainId}/approve/spender`, { headers });
    if (!spenderRes.ok) return null;
    const { address: spender } = await spenderRes.json();
    approveTx = await buildApproveTxIfNeeded(chainId, src, spender, userAddress, BigInt(amountRaw));
  }

  return { provider: '1inch', approveTx, swapTx, toAmountRaw: swapData.toAmount };
}

async function try0x(params: RealSwapPlanParams): Promise<RealSwapPlan | null> {
  const apiKey = process.env.NEXT_PUBLIC_0X_API_KEY;
  if (!apiKey) return null;

  const { chainId, fromTokenAddress, toTokenAddress, amount, fromDecimals, slippagePercent, userAddress } = params;
  const sellToken = toApiAddress(fromTokenAddress);
  const buyToken = toApiAddress(toTokenAddress);
  const sellAmount = parseUnits(amount, fromDecimals).toString();

  const quoteUrl = new URL('https://api.0x.org/swap/v1/quote');
  quoteUrl.searchParams.set('sellToken', sellToken);
  quoteUrl.searchParams.set('buyToken', buyToken);
  quoteUrl.searchParams.set('sellAmount', sellAmount);
  quoteUrl.searchParams.set('takerAddress', userAddress);
  quoteUrl.searchParams.set('slippagePercentage', String(slippagePercent / 100));

  const res = await fetch(quoteUrl.toString(), {
    headers: { '0x-api-key': apiKey, '0x-chain-id': String(chainId) },
  });
  if (!res.ok) return null;
  const quote = await res.json();

  const swapTx: RealSwapTxRequest = {
    to: quote.to,
    data: quote.data,
    value: BigInt(quote.value ?? '0'),
    gas: quote.gas ? BigInt(quote.gas) : undefined,
  };

  let approveTx: RealSwapTxRequest | null = null;
  if (sellToken !== EVM_NATIVE_SENTINEL && quote.allowanceTarget) {
    approveTx = await buildApproveTxIfNeeded(
      chainId,
      sellToken,
      quote.allowanceTarget,
      userAddress,
      BigInt(sellAmount)
    );
  }

  return { provider: '0x', approveTx, swapTx, toAmountRaw: quote.buyAmount };
}

/**
 * Build a real, sendable swap plan for a same-chain EVM swap: an optional approve
 * transaction (if the current allowance is insufficient) plus the swap transaction
 * itself, sourced from 1inch first and falling back to 0x.
 *
 * Throws if neither provider can produce a route (unsupported chain/pair, no API
 * key configured, insufficient liquidity, etc.) — callers should surface this as
 * "live swaps aren't available for this pair yet" rather than pretending success.
 */
export async function buildRealSwapPlan(params: RealSwapPlanParams): Promise<RealSwapPlan> {
  const viaOneInch = await try1inch(params).catch(() => null);
  if (viaOneInch) return viaOneInch;

  const viaZeroX = await try0x(params).catch(() => null);
  if (viaZeroX) return viaZeroX;

  throw new Error('Live swaps are not available for this network/token pair yet.');
}

export async function waitForRealReceipt(chainId: number, hash: `0x${string}`) {
  const publicClient = getPublicClient(chainId);
  return publicClient.waitForTransactionReceipt({ hash });
}
