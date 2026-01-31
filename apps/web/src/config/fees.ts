// apps/web/src/config/fees.ts

export const PLATFORM_FEES = {
  direct: parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_DIRECT || '0.004'),
  delegated: parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_DELEGATED || '0.01'),
  cex: parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_CEX || '0.01'),
} as const;

// Helper to get fee as percentage string (for display)
export function getFeePercent(route: keyof typeof PLATFORM_FEES): string {
  return `${(PLATFORM_FEES[route] * 100).toFixed(1)}%`;
}
