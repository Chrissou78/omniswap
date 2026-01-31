// apps/web/src/components/swap/utils/format.ts

/**
 * Format a number with specified decimal places
 */
export function formatNumber(value: number, decimals: number = 4): string {
  if (value === 0) return '0';
  
  if (Math.abs(value) < 0.0001) {
    return value.toExponential(2);
  }
  
  if (Math.abs(value) < 1) {
    return value.toFixed(decimals);
  }
  
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  }
  
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(2) + 'K';
  }
  
  return value.toFixed(decimals);
}

/**
 * Format a number as USD currency
 */
export function formatUSD(value: number): string {
  if (value === 0) return '$0.00';
  
  if (Math.abs(value) < 0.01) {
    return '<$0.01';
  }
  
  if (Math.abs(value) >= 1000000) {
    return '$' + (value / 1000000).toFixed(2) + 'M';
  }
  
  if (Math.abs(value) >= 1000) {
    return '$' + (value / 1000).toFixed(2) + 'K';
  }
  
  return '$' + value.toFixed(2);
}

/**
 * Shorten an address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format token amount with appropriate decimals
 */
export function formatTokenAmount(amount: string | number, decimals: number = 18): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num) || num === 0) return '0';
  
  if (num < 0.000001) {
    return num.toExponential(2);
  }
  
  if (num < 1) {
    return num.toFixed(6);
  }
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  
  return num.toFixed(4);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return value.toFixed(decimals) + '%';
}

/**
 * Parse token amount from user input
 */
export function parseTokenInput(input: string): string {
  // Remove non-numeric characters except decimal point
  let cleaned = input.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleaned;
}
