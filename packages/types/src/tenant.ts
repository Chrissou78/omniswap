// packages/types/src/tenant.ts

// Use the local Token type from this package (don't import from shared)
import type { Token } from './tokens';

/**
 * Core tenant identification and status
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'trial';
  plan: 'starter' | 'professional' | 'enterprise';
  domains: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant branding configuration
 */
export interface TenantBranding {
  name: string;
  tagline?: string;
  description?: string;
  logos: {
    primary: string;
    secondary?: string;
    favicon: string;
    appIcon?: string;
  };
  socialLinks?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    github?: string;
  };
  supportEmail?: string;
  supportUrl?: string;
}

/**
 * Tenant theme configuration
 */
export interface TenantTheme {
  colors: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    border: {
      primary: string;
      secondary: string;
    };
  };
  darkMode: {
    enabled: boolean;
    default: 'light' | 'dark' | 'system';
    colors?: Partial<TenantTheme['colors']>;
  };
  typography: {
    fontFamily: {
      primary: string;
      secondary?: string;
      mono: string;
    };
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  customCss?: string;
}

/**
 * Tenant feature flags
 */
export interface TenantFeatures {
  chains: Record<string, boolean>;
  features: {
    crossChainSwaps: boolean;
    cexRouting: boolean;
    limitOrders: boolean;
    portfolioTracking: boolean;
    priceAlerts: boolean;
  };
  ui: {
    showRouteVisualization: boolean;
    showGasEstimates: boolean;
    advancedMode: boolean;
    darkModeToggle: boolean;
  };
}

/**
 * Tenant fee configuration
 */
export interface TenantFees {
  platform: {
    onChainSwap: number;
    crossChainSwap: number;
    cexTrade: number;
  };
  tenant: {
    enabled: boolean;
    onChainSwap: number;
    crossChainSwap: number;
    cexTrade: number;
  };
  recipients: {
    [chainId: string]: string;
  };
}

/**
 * Tenant token configuration
 */
export interface TenantTokenConfig {
  mode: 'all' | 'whitelist' | 'blacklist';
  whitelist: { chainId: string; address: string }[];
  blacklist: { chainId: string; address: string }[];
  featured: Record<string, { chainId: string; address: string }[]>;
  custom: Token[];
  settings: {
    showUnverified: boolean;
    minLiquidity: number;
  };
}

/**
 * Complete tenant configuration
 */
export interface TenantConfig {
  tenant: Tenant;
  branding: TenantBranding;
  theme: TenantTheme;
  features: TenantFeatures;
  fees: TenantFees;
  tokens: TenantTokenConfig;
}
