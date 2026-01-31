'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getChainById, getChainLogo } from '../../../config';

interface ChainLogoProps {
  chainId: string | number;
  size?: number;
  className?: string;
}

export function ChainLogo({ chainId, size = 24, className = '' }: ChainLogoProps) {
  const [hasError, setHasError] = useState(false);
  const chain = getChainById(chainId);
  const logoUrl = getChainLogo(chainId);

  if (hasError) {
    return (
      <div 
        className={`rounded-full flex items-center justify-center text-white font-bold ${className}`}
        style={{ width: size, height: size, backgroundColor: chain?.color || '#627EEA', fontSize: size * 0.4 }}
      >
        {chain?.symbol?.charAt(0) || '?'}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={chain?.name || 'Chain'}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={() => setHasError(true)}
      unoptimized
    />
  );
}
