// apps/web/src/components/swap/services/realSuiSwapExecutor.ts
//
// Real same-chain Sui swap execution via 7K Protocol's aggregator SDK.
//
// Unlike EVM (1inch/0x) and Solana (Jupiter), Sui swaps aren't calldata-based:
// the transaction is a Programmable Transaction Block that has to be
// constructed client-side, which is why this needs an SDK rather than a plain
// REST call. The resulting Transaction object is handed straight to
// @mysten/dapp-kit's useSignAndExecuteTransaction, the same hook already used
// for real Sui payments in apps/web/src/components/payment/PaymentButton.tsx.
//
// NOTE: @7kprotocol/sdk-ts is pinned to the 2.x line on purpose. Its npm
// `latest` tag is a 4.x major that requires @mysten/sui v2, while this app is
// on @mysten/sui v1 - 2.x declares @mysten/sui as a proper peer dependency
// (^1.17.0), so there's only ever one copy of the Sui SDK in the bundle.

import { SuiClient } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { setSuiClient, getQuote, buildTx } from '@7kprotocol/sdk-ts';
import { getChainRpc } from '@/lib/chain-config';

export const SUI_NATIVE_COIN_TYPE = '0x2::sui::SUI';

let clientInitialised = false;

/** 7K's SDK holds a module-level SuiClient; set it once before quoting. */
function ensureSuiClient() {
  if (clientInitialised) return;
  const url = getChainRpc('sui-mainnet') || 'https://fullnode.mainnet.sui.io';
  setSuiClient(new SuiClient({ url }));
  clientInitialised = true;
}

function toCoinType(address: string): string {
  return address === 'native' ? SUI_NATIVE_COIN_TYPE : address;
}

export interface SuiSwapPlanParams {
  inputCoinType: string; // 'native' or a full Sui coin type
  outputCoinType: string;
  amount: string; // human-readable, e.g. "1.5"
  inputDecimals: number;
  slippagePercent: number; // e.g. 0.5 for 0.5%
  senderAddress: string;
}

export interface SuiSwapPlan {
  transaction: Transaction;
}

/**
 * Build a real, signable Sui swap transaction. Throws if 7K can't route the
 * pair - callers should surface that rather than pretending success.
 */
export async function buildRealSuiSwapPlan(params: SuiSwapPlanParams): Promise<SuiSwapPlan> {
  const { inputCoinType, outputCoinType, amount, inputDecimals, slippagePercent, senderAddress } =
    params;

  ensureSuiClient();

  const amountRaw = BigInt(Math.round(parseFloat(amount) * 10 ** inputDecimals)).toString();

  const quoteResponse = await getQuote({
    tokenIn: toCoinType(inputCoinType),
    tokenOut: toCoinType(outputCoinType),
    amountIn: amountRaw,
  });

  if (!quoteResponse) {
    throw new Error('Live swaps are not available for this token pair yet.');
  }

  const { tx } = await buildTx({
    quoteResponse,
    accountAddress: senderAddress,
    slippage: slippagePercent / 100, // SDK expects a fraction, e.g. 0.005
    commission: {
      partner: senderAddress,
      commissionBps: 0,
    },
  });

  if (!tx) {
    throw new Error('Could not build a Sui swap transaction for this pair.');
  }

  return { transaction: tx as Transaction };
}
