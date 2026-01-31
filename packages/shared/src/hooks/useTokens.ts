// packages/shared/src/hooks/useTokens.ts
import { useState, useEffect, useCallback } from 'react';
import { Token } from '../types';
import { ConfigService } from '../configService';
import { getTokensByChainId as localGetTokensByChainId } from '../index';

interface UseTokensOptions {
  chainId: number | string;
  configService?: ConfigService;
  enabled?: boolean;
}

interface UseTokensResult {
  tokens: Token[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getTokenByAddress: (address: string) => Token | undefined;
  searchTokens: (query: string) => Token[];
  getNativeToken: () => Token | undefined;
}

export function useTokens(options: UseTokensOptions): UseTokensResult {
  const { chainId, configService, enabled = true } = options;

  const [tokens, setTokens] = useState<Token[]>(() => localGetTokensByChainId(chainId));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!configService || !enabled) {
      setTokens(localGetTokensByChainId(chainId));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await configService.getTokensByChainId(chainId);
      setTokens(data);
    } catch (e) {
      setError(e as Error);
      // Keep local data as fallback
      setTokens(localGetTokensByChainId(chainId));
    } finally {
      setIsLoading(false);
    }
  }, [configService, chainId, enabled]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const getTokenByAddress = useCallback(
    (address: string): Token | undefined => {
      return tokens.find(
        (token: Token) => token.address.toLowerCase() === address.toLowerCase()
      );
    },
    [tokens]
  );

  const searchTokens = useCallback(
    (query: string): Token[] => {
      const q = query.toLowerCase().trim();
      if (!q) return tokens;

      return tokens.filter(
        (token: Token) =>
          token.symbol.toLowerCase().includes(q) ||
          token.name.toLowerCase().includes(q) ||
          token.address.toLowerCase().includes(q)
      );
    },
    [tokens]
  );

  const getNativeToken = useCallback((): Token | undefined => {
    return tokens.find((token: Token) => token.address === 'native');
  }, [tokens]);

  return {
    tokens,
    isLoading,
    error,
    refetch: fetchTokens,
    getTokenByAddress,
    searchTokens,
    getNativeToken,
  };
}
