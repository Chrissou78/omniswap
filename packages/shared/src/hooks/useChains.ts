// packages/shared/src/hooks/useChains.ts
import { useState, useEffect, useCallback } from 'react';
import { Chain } from '../types';
import { ConfigService } from '../configService';
import { CHAINS, getChainById as localGetChainById } from '../index';

interface UseChainsOptions {
  configService?: ConfigService;
  enabled?: boolean;
}

interface UseChainsResult {
  chains: Chain[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getChainById: (chainId: number | string) => Chain | undefined;
  searchChains: (query: string) => Chain[];
}

export function useChains(options: UseChainsOptions = {}): UseChainsResult {
  const { configService, enabled = true } = options;

  const [chains, setChains] = useState<Chain[]>(CHAINS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchChains = useCallback(async () => {
    if (!configService || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await configService.getChains();
      setChains(data);
    } catch (e) {
      setError(e as Error);
      // Keep local data as fallback
    } finally {
      setIsLoading(false);
    }
  }, [configService, enabled]);

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  const getChainById = useCallback(
    (chainId: number | string): Chain | undefined => {
      return (
        chains.find(
          (chain: Chain) => chain.id === chainId || chain.id.toString() === chainId.toString()
        ) || localGetChainById(chainId)
      );
    },
    [chains]
  );

  const searchChains = useCallback(
    (query: string): Chain[] => {
      const q = query.toLowerCase().trim();
      if (!q) return chains;

      return chains.filter(
        (chain: Chain) =>
          chain.name.toLowerCase().includes(q) ||
          chain.symbol.toLowerCase().includes(q) ||
          chain.id.toString().includes(q)
      );
    },
    [chains]
  );

  return {
    chains,
    isLoading,
    error,
    refetch: fetchChains,
    getChainById,
    searchChains,
  };
}
