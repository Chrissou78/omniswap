// apps/web/src/components/wallet/ChainSelector.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdownMenu';
import { ChevronDown, Check } from 'lucide-react';
import { Chain } from '@omniswap/types';

interface ChainSelectorProps {
  chains: Chain[];
  selectedChainId: number | string | null;
  onSelect: (chain: Chain) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const ChainSelector: React.FC<ChainSelectorProps> = ({
  chains,
  selectedChainId,
  onSelect,
  label = 'Select Chain',
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedChain = chains.find((c) => c.chainId === selectedChainId);

  const chainIcons: Record<number | string, string> = {
    1: '🔷',
    56: '🟡',
    137: '🟣',
    42161: '🔵',
    10: '🔴',
    8453: '🔵',
    43114: '🔺',
    'solana-mainnet': '🟢',
    'sui-mainnet': '🌊',
  };

  const getIcon = (chainId: number | string) => chainIcons[chainId] || '⛓️';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={`flex items-center justify-between gap-2 min-w-[160px] ${className}`}
        >
          {selectedChain ? (
            <>
              <span className="text-lg">{getIcon(selectedChain.chainId)}</span>
              <span className="flex-1 text-left">{selectedChain.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuLabel>Select Network</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* EVM Chains */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          EVM Networks
        </DropdownMenuLabel>
        {chains
          .filter((c) => c.type === 'EVM')
          .map((chain) => (
            <DropdownMenuItem
              key={chain.chainId}
              onClick={() => {
                onSelect(chain);
                setIsOpen(false);
              }}
              className="cursor-pointer"
            >
              <span className="text-lg mr-2">{getIcon(chain.chainId)}</span>
              <span className="flex-1">{chain.name}</span>
              {selectedChainId === chain.chainId && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </DropdownMenuItem>
          ))}

        <DropdownMenuSeparator />
        
        {/* Non-EVM Chains */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Other Networks
        </DropdownMenuLabel>
        {chains
          .filter((c) => c.type !== 'EVM')
          .map((chain) => (
            <DropdownMenuItem
              key={chain.chainId}
              onClick={() => {
                onSelect(chain);
                setIsOpen(false);
              }}
              className="cursor-pointer"
            >
              <span className="text-lg mr-2">{getIcon(chain.chainId)}</span>
              <span className="flex-1">{chain.name}</span>
              {selectedChainId === chain.chainId && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
