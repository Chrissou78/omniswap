export const EVM_CHAINS = [1, 56, 137, 42161, 10, 43114, 250, 8453];
export const SOLANA_CHAIN_ID = 'solana';
export const SUI_CHAIN_ID = 'sui';

export function isEvmChain(chainId: string | number): boolean {
  const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
  return EVM_CHAINS.includes(id);
}

export function isSolanaChain(chainId: string | number): boolean {
  return chainId === SOLANA_CHAIN_ID || chainId === 'solana';
}

export function isSuiChain(chainId: string | number): boolean {
  return chainId === SUI_CHAIN_ID || chainId === 'sui';
}

export function getChainType(chainId: string | number): 'evm' | 'solana' | 'sui' | 'unknown' {
  if (isEvmChain(chainId)) return 'evm';
  if (isSolanaChain(chainId)) return 'solana';
  if (isSuiChain(chainId)) return 'sui';
  return 'unknown';
}

export function normalizeChainId(chainId: string | number): string {
  return String(chainId);
}
