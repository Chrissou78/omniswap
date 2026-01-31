'use client';

import { useEffect, useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { Token } from '@omniswap/types';

interface TokenBalanceResult {
  balance: string;
  formatted: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTokenBalance(token: Token | null): TokenBalanceResult {
  const { address, isConnected } = useAccount();
  const [balance, setBalance] = useState<string>('0');
  const [formatted, setFormatted] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // EVM balance using wagmi
  const {
    data: evmBalance,
    isLoading: evmLoading,
    error: evmError,
    refetch: evmRefetch,
  } = useBalance({
    address: address,
    token: token?.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' 
      ? undefined 
      : (token?.address as `0x${string}`),
    chainId: token?.chainId,
    query: {
      enabled: isConnected && !!token && !!address && token.chainId < 1000,
    },
  });

  useEffect(() => {
    if (!token || !isConnected) {
      setBalance('0');
      setFormatted('0');
      return;
    }

    // For EVM chains (chainId < 1000)
    if (token.chainId < 1000) {
      if (evmBalance) {
        setBalance(evmBalance.value.toString());
        setFormatted(evmBalance.formatted);
      }
      setIsLoading(evmLoading);
      setError(evmError);
    } else if (token.chainId === 101) {
      // Solana - would integrate with @solana/web3.js
      // For now, return placeholder
      setBalance('0');
      setFormatted('0');
      setIsLoading(false);
    } else if (token.chainId === 784) {
      // Sui - would integrate with @mysten/sui
      // For now, return placeholder
      setBalance('0');
      setFormatted('0');
      setIsLoading(false);
    }
  }, [token, isConnected, evmBalance, evmLoading, evmError]);

  const refetch = () => {
    if (token && token.chainId < 1000) {
      evmRefetch();
    }
  };

  return {
    balance,
    formatted,
    isLoading,
    error,
    refetch,
  };
}