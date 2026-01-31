// apps/web/src/services/feeCollectorService.ts
'use client';

export interface FeeReceiverConfig {
  // MEXC deposit addresses per chain (from MEXC account)
  depositAddresses: Record<number | string, {
    native: string;    // For native token fees (ETH, BNB, etc.)
    usdt?: string;     // For USDT fees
    usdc?: string;     // For USDC fees
  }>;
  
  // Fallback: direct treasury wallets
  treasuryAddresses: Record<number | string, string>;
}

// These should come from environment variables or API
const FEE_RECEIVER_CONFIG: FeeReceiverConfig = {
  depositAddresses: {
    // Ethereum Mainnet
    1: {
      native: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_ETH || '0x...',
      usdt: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_ETH_USDT || '0x...',
      usdc: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_ETH_USDC || '0x...',
    },
    // BSC
    56: {
      native: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_BSC || '0x...',
      usdt: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_BSC_USDT || '0x...',
      usdc: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_BSC_USDC || '0x...',
    },
    // Polygon
    137: {
      native: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_POLYGON || '0x...',
      usdt: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_POLYGON_USDT || '0x...',
      usdc: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_POLYGON_USDC || '0x...',
    },
    // Arbitrum
    42161: {
      native: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_ARB || '0x...',
      usdt: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_ARB_USDT || '0x...',
      usdc: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_ARB_USDC || '0x...',
    },
    // Solana
    'solana': {
      native: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_SOL || 'So1...',
      usdt: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_SOL_USDT || 'So1...',
      usdc: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_SOL_USDC || 'So1...',
    },
    // Sui
    'sui': {
      native: process.env.NEXT_PUBLIC_MEXC_DEPOSIT_SUI || '0x...',
    },
  },
  treasuryAddresses: {
    1: process.env.NEXT_PUBLIC_TREASURY_ETH || '0x...',
    56: process.env.NEXT_PUBLIC_TREASURY_BSC || '0x...',
    137: process.env.NEXT_PUBLIC_TREASURY_POLYGON || '0x...',
    42161: process.env.NEXT_PUBLIC_TREASURY_ARB || '0x...',
    'solana': process.env.NEXT_PUBLIC_TREASURY_SOL || 'So1...',
    'sui': process.env.NEXT_PUBLIC_TREASURY_SUI || '0x...',
  },
};

export type FeeToken = 'native' | 'usdt' | 'usdc';

/**
 * Get the fee receiver address for a specific chain and token
 */
export function getFeeReceiverAddress(
  chainId: number | string,
  feeToken: FeeToken = 'native'
): string | null {
  const chainConfig = FEE_RECEIVER_CONFIG.depositAddresses[chainId];
  
  if (chainConfig) {
    const address = chainConfig[feeToken] || chainConfig.native;
    if (address && address !== '0x...') {
      return address;
    }
  }
  
  // Fallback to treasury
  const treasury = FEE_RECEIVER_CONFIG.treasuryAddresses[chainId];
  if (treasury && treasury !== '0x...') {
    return treasury;
  }
  
  return null;
}

/**
 * Calculate fee amount and determine best token to collect in
 */
export function calculateFeeCollection(
  chainId: number | string,
  valueUsd: number,
  feePercent: number,
  availableTokens: { symbol: string; balance: number; isNative: boolean }[]
): {
  feeUsd: number;
  feeToken: FeeToken;
  feeAmount: number;
  receiverAddress: string | null;
} {
  const feeUsd = valueUsd * feePercent;
  
  // Prefer stablecoins for fee collection
  const usdt = availableTokens.find(t => t.symbol === 'USDT' && t.balance >= feeUsd);
  const usdc = availableTokens.find(t => t.symbol === 'USDC' && t.balance >= feeUsd);
  const native = availableTokens.find(t => t.isNative);
  
  let feeToken: FeeToken = 'native';
  let feeAmount = feeUsd;
  
  if (usdt) {
    feeToken = 'usdt';
    feeAmount = feeUsd; // 1:1 for stablecoins
  } else if (usdc) {
    feeToken = 'usdc';
    feeAmount = feeUsd;
  }
  // For native, caller needs to convert using price
  
  const receiverAddress = getFeeReceiverAddress(chainId, feeToken);
  
  return {
    feeUsd,
    feeToken,
    feeAmount,
    receiverAddress,
  };
}

/**
 * Platform fee rates
 */
export const PLATFORM_FEES = {
  direct: 0.004,    // 0.4%
  delegated: 0.01,  // 1%
  cex: 0.01,        // 1%
} as const;

export type RouteType = keyof typeof PLATFORM_FEES;

export function getPlatformFee(routeType: RouteType): number {
  return PLATFORM_FEES[routeType];
}
