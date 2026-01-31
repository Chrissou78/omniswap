'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getChainById, getTokenLogo } from '../../../config';
import type { Token } from '../../../types';

interface TokenLogoProps {
  token: Token;
  size?: number;
  className?: string;
}

export function TokenLogo({ token, size = 32, className = '' }: TokenLogoProps) {
  const [hasError, setHasError] = useState(false);
  const chain = getChainById(token.chainId);
  const logoUrl = getTokenLogo(token);

  if (hasError) {
    return (
      <div 
        className={`rounded-full flex items-center justify-center text-white font-bold ${className}`}
        style={{ width: size, height: size, backgroundColor: chain?.color || '#627EEA', fontSize: size * 0.4 }}
      >
        {token.symbol.charAt(0)}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={token.symbol}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={() => setHasError(true)}
      unoptimized
    />
  );
}
