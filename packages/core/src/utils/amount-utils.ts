// packages/core/src/utils/amount-utils.ts

/**
 * Format amount from smallest unit to human readable
 */
export function formatUnits(amount: string | bigint, decimals: number): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return integerPart.toString();
  }
  
  return `${integerPart}.${trimmedFractional}`;
}

/**
 * Parse human readable amount to smallest unit
 */
export function parseUnits(amount: string, decimals: number): bigint {
  const [integerPart, fractionalPart = ''] = amount.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  
  return BigInt(integerPart + paddedFractional);
}

/**
 * Format amount for display with proper precision
 */
export function formatDisplayAmount(
  amount: string | bigint,
  decimals: number,
  maxDecimals = 6
): string {
  const formatted = formatUnits(amount, decimals);
  const [integer, fractional = ''] = formatted.split('.');
  
  if (fractional === '') {
    return integer;
  }
  
  const truncatedFractional = fractional.slice(0, maxDecimals);
  return `${integer}.${truncatedFractional}`;
}
