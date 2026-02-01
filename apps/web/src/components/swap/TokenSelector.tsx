'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TokenLogo } from './components/TokenLogo';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId?: number;
  price?: number;
}

interface TokenSelectorProps {
  tokens?: Token[];
  onSelect: (token: Token) => void;
  selectedToken?: Token | null;
  chainId?: number;
  excludeAddresses?: string[];
}

export function TokenSelector({ 
  tokens = [], 
  onSelect, 
  selectedToken, 
  chainId,
  excludeAddresses = []
}: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  
  const filteredTokens = useMemo(() => {
    const searchLower = search.toLowerCase();
    return tokens
      .filter(token => !excludeAddresses.includes(token.address.toLowerCase()))
      .filter(token => 
        token.symbol.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower) ||
        token.address.toLowerCase().includes(searchLower)
      )
      .slice(0, 100); // Limit for performance
  }, [tokens, search, excludeAddresses]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search by name or paste address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-zinc-800 border-zinc-700 focus:border-zinc-600"
        />
      </div>
      
      <ScrollArea className="h-80">
        <div className="space-y-1">
          {filteredTokens.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No tokens found</p>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => onSelect(token)}
                className={
                  "w-full flex items-center gap-3 p-3 rounded-lg transition-colors " +
                  (selectedToken?.address?.toLowerCase() === token.address.toLowerCase()
                    ? "bg-zinc-700"
                    : "hover:bg-zinc-800")
                }
              >
                <TokenLogo src={token.logoURI} symbol={token.symbol} size={36} />
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-sm text-zinc-500 truncate w-full text-left">
                    {token.name}
                  </span>
                </div>
                {token.price && (
                  <span className="text-sm text-zinc-400">
                    \${token.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}