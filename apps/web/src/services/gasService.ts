// apps/web/src/services/gasService.ts
'use client';

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  estimatedCostWei: bigint;
  estimatedCostNative: number;
  estimatedCostUsd: number;
}

// Realistic gas limits based on operation type
const GAS_LIMITS = {
  simpleSwap: 150000n,      // Same-chain DEX swap
  complexSwap: 300000n,     // Multi-hop or complex routing
  crossChain: 200000n,      // Cross-chain initiation (source chain)
  approval: 46000n,         // ERC20 approval
};

// Current realistic gas prices by chain (in wei) - Updated Jan 2026
// These are base fees, actual may vary
const CHAIN_GAS_CONFIG: Record<number, { gasPrice: bigint; symbol: string; decimals: number }> = {
  1: { gasPrice: 15000000000n, symbol: 'ETH', decimals: 18 },        // ~15 gwei Ethereum
  56: { gasPrice: 1000000000n, symbol: 'BNB', decimals: 18 },        // ~1 gwei BSC
  137: { gasPrice: 30000000000n, symbol: 'POL', decimals: 18 },      // ~30 gwei Polygon
  42161: { gasPrice: 10000000n, symbol: 'ETH', decimals: 18 },       // ~0.01 gwei Arbitrum
  10: { gasPrice: 1000000n, symbol: 'ETH', decimals: 18 },           // ~0.001 gwei Optimism
  8453: { gasPrice: 1000000n, symbol: 'ETH', decimals: 18 },         // ~0.001 gwei Base
  43114: { gasPrice: 25000000000n, symbol: 'AVAX', decimals: 18 },   // ~25 nAVAX Avalanche
  250: { gasPrice: 10000000000n, symbol: 'FTM', decimals: 18 },      // ~10 gwei Fantom
  324: { gasPrice: 250000000n, symbol: 'ETH', decimals: 18 },        // ~0.25 gwei zkSync
  59144: { gasPrice: 50000000n, symbol: 'ETH', decimals: 18 },       // Linea
  81457: { gasPrice: 1000000n, symbol: 'ETH', decimals: 18 },        // Blast
  534352: { gasPrice: 100000000n, symbol: 'ETH', decimals: 18 },     // Scroll
  5000: { gasPrice: 50000000n, symbol: 'MNT', decimals: 18 },        // Mantle
  146: { gasPrice: 1000000000n, symbol: 'S', decimals: 18 },         // Sonic
};

export async function estimateSwapGas(
  chainId: number,
  fromToken: string,
  toToken: string,
  amount: bigint,
  isCrossChain: boolean = false,
  nativePriceUsd: number = 0
): Promise<GasEstimate> {
  const config = CHAIN_GAS_CONFIG[chainId] || CHAIN_GAS_CONFIG[1];
  
  // Determine gas limit based on swap type
  let gasLimit: bigint;
  if (isCrossChain) {
    gasLimit = GAS_LIMITS.crossChain;
  } else if (fromToken === 'native' || toToken === 'native') {
    gasLimit = GAS_LIMITS.simpleSwap;
  } else {
    // Token to token swaps are more complex
    gasLimit = GAS_LIMITS.complexSwap;
  }

  const gasPrice = config.gasPrice;
  const estimatedCostWei = gasLimit * gasPrice;
  const estimatedCostNative = Number(estimatedCostWei) / (10 ** config.decimals);
  const estimatedCostUsd = estimatedCostNative * nativePriceUsd;

  return {
    gasLimit,
    gasPrice,
    estimatedCostWei,
    estimatedCostNative,
    estimatedCostUsd,
  };
}

export function formatGasCost(costNative: number, costUsd: number, symbol: string): string {
  // Format native cost
  let nativeStr: string;
  if (costNative < 0.000001) {
    nativeStr = '<0.000001';
  } else if (costNative < 0.001) {
    nativeStr = costNative.toFixed(6);
  } else if (costNative < 1) {
    nativeStr = costNative.toFixed(4);
  } else {
    nativeStr = costNative.toFixed(2);
  }

  // Format USD cost
  if (costUsd > 0.01) {
    return `~${nativeStr} ${symbol} ($${costUsd.toFixed(2)})`;
  } else if (costUsd > 0) {
    return `~${nativeStr} ${symbol} (<$0.01)`;
  }
  return `~${nativeStr} ${symbol}`;
}
