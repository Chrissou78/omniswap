// apps/web/src/services/configService.ts

import { createConfigService, ConfigService } from '@omniswap/shared';

// Create singleton instance for web
let configServiceInstance: ConfigService | null = null;

export function getConfigService(): ConfigService {
  if (!configServiceInstance) {
    configServiceInstance = createConfigService({
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.omniswap.io',
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      storage: {
        getItem: async (key: string) => {
          if (typeof window === 'undefined') return null;
          return localStorage.getItem(key);
        },
        setItem: async (key: string, value: string) => {
          if (typeof window === 'undefined') return;
          localStorage.setItem(key, value);
        },
      },
      onError: (error) => {
        console.error('[ConfigService] Error:', error.message);
      },
    });
  }
  return configServiceInstance;
}

// Export convenience functions
export const configService = {
  getChains: () => getConfigService().getChains(),
  getChainById: (chainId: number | string) => getConfigService().getChainById(chainId),
  searchChains: (query: string) => getConfigService().searchChains(query),
  getTokens: (chainId?: number | string) => getConfigService().getTokens(chainId),
  getTokensByChainId: (chainId: number | string) => getConfigService().getTokensByChainId(chainId),
  getTokenByAddress: (chainId: number | string, address: string) =>
    getConfigService().getTokenByAddress(chainId, address),
  searchTokens: (chainId: number | string, query: string) =>
    getConfigService().searchTokens(chainId, query),
  getNativeToken: (chainId: number | string) => getConfigService().getNativeToken(chainId),
  checkForUpdates: () => getConfigService().checkForUpdates(),
  clearCache: () => getConfigService().clearCache(),
  // Sync fallbacks (for SSR or immediate needs)
  getLocalChains: () => getConfigService().getLocalChains(),
  getLocalTokens: (chainId?: number | string) => getConfigService().getLocalTokens(chainId),
};

export default configService;
