'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBalance, useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { getChainById } from '../../../config';
import { isNativeToken } from '../utils';
import type { Token } from '../../../types';
import type { TokenBalances } from '../types';

export function useEvmTokenBalances(
  chainId: string | number, 
  tokens: Token[], 
  address?: string
): TokenBalances {
  const [balances, setBalances] = useState<TokenBalances>({});
  const chain = getChainById(chainId);
  
  const { data: nativeBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: typeof chainId === 'number' ? chainId : undefined,
  });

  const erc20Tokens = useMemo(() => 
    tokens.filter(t => !isNativeToken(t) && chain?.type === 'evm'),
    [tokens, chain?.type]
  );

  const contracts = useMemo(() => 
    erc20Tokens.map(token => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
      chainId: typeof chainId === 'number' ? chainId : undefined,
    })),
    [erc20Tokens, address, chainId]
  );

  const { data: erc20Balances } = useReadContracts({
    contracts: address && chain?.type === 'evm' ? contracts : [],
    query: {
      enabled: !!address && chain?.type === 'evm' && erc20Tokens.length > 0,
    }
  });

  useEffect(() => {
    const newBalances: TokenBalances = {};

    if (nativeBalance) {
      newBalances['native'] = {
        balance: formatUnits(nativeBalance.value, nativeBalance.decimals),
      };
    }

    if (erc20Balances) {
      erc20Balances.forEach((result, index) => {
        if (result.status === 'success' && result.result !== undefined) {
          const token = erc20Tokens[index];
          const balance = formatUnits(result.result as bigint, token.decimals);
          newBalances[token.address.toLowerCase()] = { balance };
        }
      });
    }

    setBalances(newBalances);
  }, [nativeBalance, erc20Balances, erc20Tokens]);

  return balances;
}
