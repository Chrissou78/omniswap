// apps/web/src/components/swap/services/realSolanaSwapExecutor.ts
//
// Real same-chain Solana swap execution via Jupiter's public swap API
// (https://quote-api.jup.ag/v6). Nothing here is mocked — if Jupiter can't
// route the requested pair, this throws rather than pretending success.

import { VersionedTransaction, type Connection } from '@solana/web3.js';

export const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112';

function toMint(address: string): string {
  return address === 'native' ? SOLANA_NATIVE_MINT : address;
}

// Browser-native base64 -> bytes. Avoids relying on Node's Buffer global,
// which this app doesn't polyfill for the client bundle.
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface SolanaSwapPlanParams {
  inputMint: string; // 'native' or an SPL mint address
  outputMint: string;
  amount: string; // human-readable, e.g. "1.5"
  inputDecimals: number;
  slippageBps: number; // e.g. 50 for 0.5%
  userPublicKey: string;
}

export interface SolanaSwapPlan {
  transaction: VersionedTransaction;
  outAmountRaw: string;
}

/**
 * Build a real, signable Solana swap transaction via Jupiter: fetch a quote,
 * then Jupiter's /swap endpoint for a ready-to-sign VersionedTransaction.
 * Throws if Jupiter can't route the pair — callers should surface this as
 * "live swaps aren't available for this pair yet" rather than faking success.
 */
export async function buildRealSolanaSwapPlan(params: SolanaSwapPlanParams): Promise<SolanaSwapPlan> {
  const { inputMint, outputMint, amount, inputDecimals, slippageBps, userPublicKey } = params;

  const amountRaw = Math.round(parseFloat(amount) * 10 ** inputDecimals).toString();

  const quoteUrl = new URL('https://quote-api.jup.ag/v6/quote');
  quoteUrl.searchParams.set('inputMint', toMint(inputMint));
  quoteUrl.searchParams.set('outputMint', toMint(outputMint));
  quoteUrl.searchParams.set('amount', amountRaw);
  quoteUrl.searchParams.set('slippageBps', String(slippageBps));

  const quoteRes = await fetch(quoteUrl.toString());
  if (!quoteRes.ok) {
    throw new Error('Live swaps are not available for this token pair yet.');
  }
  const quoteResponse = await quoteRes.json();

  const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
    }),
  });
  if (!swapRes.ok) {
    throw new Error('Live swaps are not available for this token pair yet.');
  }
  const { swapTransaction } = await swapRes.json();

  const transaction = VersionedTransaction.deserialize(base64ToBytes(swapTransaction));

  return { transaction, outAmountRaw: quoteResponse.outAmount };
}

export async function confirmRealSolanaTransaction(connection: Connection, signature: string) {
  const latestBlockhash = await connection.getLatestBlockhash();
  return connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed'
  );
}
