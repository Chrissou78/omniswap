// packages/shared/src/types.ts

export interface Chain {
  id: number | string;
  name: string;
  symbol: string;
  color: string;
  type: 'evm' | 'solana' | 'sui' | 'tron';
  trustwalletId: string | null;
  dexscreenerId: string | null;
  defillamaId: string | null;
  coingeckoAssetPlatform: string | null;
  wrappedNativeAddress: string | null;
  rpcEnvKey: string;
  rpcDefault: string;
  explorerUrl: string;
  explorerName: string;
  popularity: number;
  // Optional fields for extended data
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet?: boolean;
  isActive?: boolean;
}

export interface Token {
  chainId: number | string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  tags: string[];
  popularity: number;
  // Optional fields
  coingeckoId?: string;
  isNative?: boolean;
  isCustom?: boolean;
  isVerified?: boolean;
  priceUsd?: number;
}

export interface ConfigVersion {
  chains: string;
  tokens: string;
  version: string;
}

export interface ConfigData {
  chains: Chain[];
  tokens: Token[];
  version: ConfigVersion;
  lastUpdated: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}

export interface ChainsResponse {
  chains: Chain[];
  version: string;
  lastUpdated: string;
}

export interface TokensResponse {
  tokens: Token[];
  chainId?: number | string;
  version: string;
  lastUpdated: string;
}
