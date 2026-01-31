// apps/web/src/hooks/useChains.ts
import { useChains as useSharedChains } from '@omniswap/shared';
import { getConfigService } from '@/services/configService';

export function useChains() {
  return useSharedChains({
    configService: getConfigService(),
    enabled: true,
  });
}

export default useChains;
