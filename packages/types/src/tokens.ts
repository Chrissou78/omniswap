// packages/types/src/tokens.ts
export interface Token {
  chainId: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  coingeckoId?: string;
  verified: boolean;
  
  // Pricing (optional, populated by price service)
  priceUsd?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
  
  // Metadata
  sources?: string[];
  tags?: string[];
  isNative?: boolean;
  isStablecoin?: boolean;
  
  // Tenant-specific
  isCustom?: boolean;
  addedBy?: string;
  addedAt?: Date;
}

export interface TokenBalance {
  token: Token;
  balance: string;          // Raw balance
  balanceFormatted: string; // Human readable
  balanceUsd?: number;
}

export interface TokenPair {
  baseToken: Token;
  quoteToken: Token;
  price: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
}
