// apps/web/src/services/delegatedSwapService.ts
'use client';

import { 
  type DelegatedSwapRequest, 
  type DelegatedSwapQuote, 
  type DelegatedSwapResult,
  type RelayerConfig 
} from '@/types/delegated';

// Service fee: 1% of output
const SERVICE_FEE_PERCENT = 1;

// Minimum swap value for delegated swaps (to cover gas costs)
const MIN_SWAP_USD = 10;
const MAX_SWAP_USD = 50000;

// Supported chains for delegated swaps
const SUPPORTED_CHAINS = [1, 56, 137, 42161, 10, 8453, 43114];

// Cache for quotes
const quoteCache = new Map<string, { quote: DelegatedSwapQuote; timestamp: number }>();
const QUOTE_CACHE_TTL = 30000; // 30 seconds

/**
 * Check if delegated swap is available for a given chain
 */
export function isDelegatedSwapAvailable(chainId: number): boolean {
  return SUPPORTED_CHAINS.includes(chainId);
}

/**
 * Get relayer configuration
 */
export async function getRelayerConfig(): Promise<RelayerConfig> {
  try {
    const response = await fetch('/api/delegated/config');
    if (!response.ok) {
      throw new Error('Failed to fetch relayer config');
    }
    return response.json();
  } catch (error) {
    // Return default config if API fails
    return {
      address: process.env.NEXT_PUBLIC_RELAYER_ADDRESS || '',
      supportedChains: SUPPORTED_CHAINS,
      minSwapUsd: MIN_SWAP_USD,
      maxSwapUsd: MAX_SWAP_USD,
      serviceFeePercent: SERVICE_FEE_PERCENT,
    };
  }
}

/**
 * Get a quote for delegated swap
 */
export async function getDelegatedSwapQuote(
  chainId: number,
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  inputPriceUsd: number,
  outputPriceUsd: number,
  estimatedGasUsd: number
): Promise<DelegatedSwapQuote | null> {
  const cacheKey = `${chainId}:${inputToken}:${outputToken}:${inputAmount}`;
  
  // Check cache
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL) {
    return cached.quote;
  }

  // Check if chain is supported
  if (!SUPPORTED_CHAINS.includes(chainId)) {
    console.log(`[Delegated] Chain ${chainId} not supported for delegated swaps`);
    return null;
  }

  const inputAmountNum = parseFloat(inputAmount);
  const valueUsd = inputAmountNum * inputPriceUsd;

  // Check minimum/maximum
  if (valueUsd < MIN_SWAP_USD) {
    console.log(`[Delegated] Value $${valueUsd.toFixed(2)} below minimum $${MIN_SWAP_USD}`);
    return null;
  }

  if (valueUsd > MAX_SWAP_USD) {
    console.log(`[Delegated] Value $${valueUsd.toFixed(2)} above maximum $${MAX_SWAP_USD}`);
    return null;
  }

  try {
    // Calculate output (simplified - in production, get from DEX aggregator)
    const outputValueUsd = valueUsd * 0.997; // 0.3% DEX fee
    const outputAmount = outputValueUsd / outputPriceUsd;

    // Calculate service fee (1% of output)
    const serviceFeeAmount = outputAmount * (SERVICE_FEE_PERCENT / 100);
    const serviceFeeUsd = serviceFeeAmount * outputPriceUsd;
    const outputAmountAfterFee = outputAmount - serviceFeeAmount;

    const quote: DelegatedSwapQuote = {
      inputAmount,
      outputAmount: outputAmount.toFixed(8),
      outputAmountAfterFee: outputAmountAfterFee.toFixed(8),
      serviceFeePercent: SERVICE_FEE_PERCENT,
      serviceFeeAmount: serviceFeeAmount.toFixed(8),
      serviceFeeUsd,
      estimatedGasUsd,
      platformCoversGas: true,
      route: 'delegated',
      routeDescription: 'Gasless swap - Platform sponsors gas, 1% service fee',
      estimatedTime: '~30s - 2min',
      quoteId: `dq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      expiresAt: Date.now() + 60000, // 1 minute validity
    };

    // Cache the quote
    quoteCache.set(cacheKey, { quote, timestamp: Date.now() });

    console.log(`[Delegated] Quote generated:`, {
      input: `${inputAmount} ($${valueUsd.toFixed(2)})`,
      output: `${outputAmountAfterFee.toFixed(6)} ($${(outputAmountAfterFee * outputPriceUsd).toFixed(2)})`,
      fee: `${serviceFeeAmount.toFixed(6)} ($${serviceFeeUsd.toFixed(2)})`,
      gasSaved: `$${estimatedGasUsd.toFixed(2)}`,
    });

    return quote;
  } catch (error) {
    console.error('[Delegated] Error generating quote:', error);
    return null;
  }
}

/**
 * Execute a delegated swap
 */
export async function executeDelegatedSwap(
  request: DelegatedSwapRequest
): Promise<DelegatedSwapResult> {
  try {
    const response = await fetch('/api/delegated/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        inputAmount: request.inputAmount,
        outputAmount: '0',
        serviceFee: '0',
        error: result.error || 'Swap failed',
      };
    }

    return {
      success: true,
      txHash: result.txHash,
      inputAmount: request.inputAmount,
      outputAmount: result.outputAmount,
      serviceFee: result.serviceFee,
    };
  } catch (error) {
    console.error('[Delegated] Swap execution error:', error);
    return {
      success: false,
      inputAmount: request.inputAmount,
      outputAmount: '0',
      serviceFee: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the typed data for signing a delegated swap request
 */
export function getDelegatedSwapTypedData(
  chainId: number,
  userAddress: string,
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  minOutputAmount: string,
  deadline: number,
  nonce: number
) {
  return {
    domain: {
      name: 'OmniSwap Delegated',
      version: '1',
      chainId,
      verifyingContract: process.env.NEXT_PUBLIC_DELEGATED_SWAP_CONTRACT as `0x${string}`,
    },
    types: {
      DelegatedSwap: [
        { name: 'user', type: 'address' },
        { name: 'inputToken', type: 'address' },
        { name: 'outputToken', type: 'address' },
        { name: 'inputAmount', type: 'uint256' },
        { name: 'minOutputAmount', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'DelegatedSwap' as const,
    message: {
      user: userAddress,
      inputToken,
      outputToken,
      inputAmount,
      minOutputAmount,
      deadline,
      nonce,
    },
  };
}

/**
 * Check if a token supports permit (EIP-2612)
 */
export async function checkPermitSupport(
  chainId: number,
  tokenAddress: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/delegated/permit-check?chainId=${chainId}&token=${tokenAddress}`
    );
    const data = await response.json();
    return data.supportsPermit || false;
  } catch {
    return false;
  }
}

export { SERVICE_FEE_PERCENT, MIN_SWAP_USD, MAX_SWAP_USD, SUPPORTED_CHAINS };
