// apps/web/src/hooks/useTokens.ts
import { useTokens as useSharedTokens } from '@omniswap/shared';
import { getConfigService } from '../services/configService';

export function useTokens(chainId: number | string) {
  return useSharedTokens({
    chainId,
    configService: getConfigService(),
    enabled: true,
  });
}

export default useTokens;
