// apps/api/src/services/tenant.service.ts
import { TenantConfig, TenantTheme, TenantBranding } from '@omniswap/types';
import { db } from '../db';
import { redis } from '../utils/redis';

export class TenantService {
  private cachePrefix = 'tenant:';
  private cacheTTL = 300; // 5 minutes

  async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    // Check cache first
    const cached = await redis.get(`${this.cachePrefix}${tenantId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Load from database
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        config: true,
      },
    });

    if (!tenant) {
      return null;
    }

    const config: TenantConfig = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status as any,
        plan: tenant.plan as any,
        domains: tenant.domains,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
      branding: tenant.config?.branding as TenantBranding || this.getDefaultBranding(),
      theme: tenant.config?.theme as TenantTheme || this.getDefaultTheme(),
      features: tenant.config?.features as any || this.getDefaultFeatures(),
      fees: tenant.config?.fees as any || this.getDefaultFees(),
      tokens: tenant.config?.tokens as any || this.getDefaultTokenConfig(),
    };

    // Cache the config
    await redis.setex(
      `${this.cachePrefix}${tenantId}`,
      this.cacheTTL,
      JSON.stringify(config)
    );

    return config;
  }

  async updateTenantConfig(
    tenantId: string,
    updates: Partial<TenantConfig>
  ): Promise<TenantConfig> {
    const current = await this.getTenantConfig(tenantId);
    if (!current) {
      throw new Error('Tenant not found');
    }

    // Update in database
    await db.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        branding: updates.branding || current.branding,
        theme: updates.theme || current.theme,
        features: updates.features || current.features,
        fees: updates.fees || current.fees,
        tokens: updates.tokens || current.tokens,
      },
      update: {
        ...(updates.branding && { branding: updates.branding }),
        ...(updates.theme && { theme: updates.theme }),
        ...(updates.features && { features: updates.features }),
        ...(updates.fees && { fees: updates.fees }),
        ...(updates.tokens && { tokens: updates.tokens }),
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await redis.del(`${this.cachePrefix}${tenantId}`);

    return this.getTenantConfig(tenantId) as Promise<TenantConfig>;
  }

  private getDefaultBranding(): TenantBranding {
    return {
      name: 'OmniSwap',
      tagline: 'Swap Anything, Anywhere',
      logos: {
        primary: '/logo.svg',
        favicon: '/favicon.ico',
      },
    };
  }

  private getDefaultTheme(): TenantTheme {
    return {
      colors: {
        primary: '#6366F1',
        primaryHover: '#4F46E5',
        primaryLight: '#E0E7FF',
        secondary: '#8B5CF6',
        accent: '#F59E0B',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        background: {
          primary: '#FFFFFF',
          secondary: '#F9FAFB',
          tertiary: '#F3F4F6',
        },
        text: {
          primary: '#111827',
          secondary: '#6B7280',
          tertiary: '#9CA3AF',
          inverse: '#FFFFFF',
        },
        border: {
          primary: '#E5E7EB',
          secondary: '#D1D5DB',
        },
      },
      darkMode: {
        enabled: true,
        default: 'system',
      },
      typography: {
        fontFamily: {
          primary: 'Inter, sans-serif',
          mono: 'JetBrains Mono, monospace',
        },
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
      },
    };
  }

  private getDefaultFeatures() {
    return {
      chains: {
        ethereum: true,
        arbitrum: true,
        optimism: true,
        polygon: true,
        bsc: true,
        base: true,
        avalanche: true,
        solana: true,
        sui: true,
      },
      features: {
        crossChainSwaps: true,
        cexRouting: false,
        limitOrders: false,
        portfolioTracking: true,
        priceAlerts: false,
      },
      ui: {
        showRouteVisualization: true,
        showGasEstimates: true,
        advancedMode: false,
        darkModeToggle: true,
      },
    };
  }

  private getDefaultFees() {
    return {
      platform: {
        onChainSwap: 0.004,
        crossChainSwap: 0.005,
        cexTrade: 0.01,
      },
      tenant: {
        enabled: false,
        onChainSwap: 0,
        crossChainSwap: 0,
        cexTrade: 0,
      },
      recipients: {},
    };
  }

  private getDefaultTokenConfig() {
    return {
      mode: 'all',
      whitelist: [],
      blacklist: [],
      featured: {},
      custom: [],
      settings: {
        showUnverified: false,
        minLiquidity: 10000,
      },
    };
  }
}
