// apps/web/src/app/admin/tokens/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface Token {
  id: string;
  chainId: string;
  chain: { name: string; symbol: string };
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
  isActive: boolean;
  isNative: boolean;
  isStablecoin: boolean;
  popularity: number;
  tags: string[];
  coingeckoId?: string;
}

interface Chain {
  id: string | number;
  name: string;
  symbol: string;
  trustwalletId?: string | null;
}

const ITEMS_PER_PAGE = 50;

// Token logo component with proper fallback
function TokenLogo({ 
  token, 
  size = 'md' 
}: { 
  token: Token; 
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-lg',
  };

  useEffect(() => {
    setImgError(false);
  }, [token.id, token.logoUrl]);

  const showFallback = !token.logoUrl || imgError;

  const getTokenColor = (symbol: string) => {
    const colors = [
      '#627EEA', '#F7931A', '#26A17B', '#2775CA', '#E84142',
      '#8247E5', '#00D395', '#FF007A', '#1969FF', '#F0B90B'
    ];
    const index = symbol.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const color = getTokenColor(token.symbol);

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold overflow-hidden`}
      style={{ 
        backgroundColor: color + '33', 
        border: `2px solid ${color}` 
      }}
    >
      {!showFallback ? (
        <img
          src={token.logoUrl!}
          alt={token.symbol}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{token.symbol.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chainFilter, setChainFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchTokens();
    fetchChains();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, chainFilter]);

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/admin/tokens');
      if (res.ok) {
        setTokens(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChains = async () => {
    try {
      const res = await fetch('/api/admin/chains');
      if (res.ok) {
        setChains(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch chains:', error);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyToClipboard = async (text: string, fieldId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter tokens
  const filteredTokens = useMemo(() => {
    return tokens.filter(token => {
      const matchesSearch = 
        token.symbol.toLowerCase().includes(search.toLowerCase()) ||
        token.name.toLowerCase().includes(search.toLowerCase()) ||
        token.address.toLowerCase().includes(search.toLowerCase());
      const matchesChain = chainFilter === 'all' || token.chainId === chainFilter;
      return matchesSearch && matchesChain;
    });
  }, [tokens, search, chainFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTokens.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTokens = filteredTokens.slice(startIndex, endIndex);

  // Get chain info for a token
  const getChainForToken = (chainId: string) => {
    return chains.find(c => String(c.id) === chainId);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Tokens</h1>
        </div>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-[#1a1b23] rounded-xl p-4 animate-pulse border border-gray-800">
              <div className="h-6 bg-gray-800 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Tokens</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filteredTokens.length} tokens {filteredTokens.length !== tokens.length && `(filtered from ${tokens.length})`}
          </p>
        </div>
        <Link
          href="/admin/tokens/new"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Token
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, symbol, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1b23] border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={chainFilter}
          onChange={(e) => setChainFilter(e.target.value)}
          className="bg-[#1a1b23] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="all">All Chains</option>
          {chains.map(chain => (
            <option key={chain.id} value={String(chain.id)}>{chain.name}</option>
          ))}
        </select>
      </div>

      {/* Tokens List */}
      <div className="space-y-3">
        {paginatedTokens.map((token) => {
          const isExpanded = expandedId === token.id;
          const chain = getChainForToken(token.chainId);

          return (
            <div
              key={token.id}
              className={`bg-[#1a1b23] rounded-xl overflow-hidden transition-all duration-300 border ${
                isExpanded ? 'border-blue-500/50' : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              {/* Main Row - Clickable */}
              <div
                onClick={() => toggleExpand(token.id)}
                className="flex items-center justify-between p-4 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Logo */}
                  <TokenLogo token={token} size="md" />

                  {/* Name & Symbol */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{token.symbol}</span>
                      <span className="text-gray-500 text-sm">{token.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-0.5 flex-wrap">
                      <span className="text-gray-500">{token.chain.name}</span>
                      {token.tags && token.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            tag === 'native' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            tag === 'stablecoin' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            tag === 'wrapped' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            tag === 'defi' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                            tag === 'meme' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            tag === 'governance' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                            tag === 'lsd' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            tag === 'gaming' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Quick Stats */}
                  <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1" title="Popularity">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      {token.popularity}
                    </span>
                    <span className="flex items-center gap-1" title="Decimals">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      {token.decimals}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    token.isActive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {token.isActive ? 'Active' : 'Inactive'}
                  </div>

                  {/* Expand Arrow */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    isExpanded ? 'bg-blue-500/10' : 'bg-gray-800/50'
                  }`}>
                    <svg
                      className={`w-5 h-5 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180 text-blue-400' : 'text-gray-500'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="border-t border-gray-800 p-5 space-y-5 bg-[#12131a]">
                  {/* Grid of Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Basic Info */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        Basic Info
                      </h3>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Symbol</span>
                          <span className="text-white font-semibold">{token.symbol}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Name</span>
                          <span className="text-white">{token.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Decimals</span>
                          <span className="text-white font-mono">{token.decimals}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Popularity</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${token.popularity}%` }}
                              />
                            </div>
                            <span className="text-white text-xs">{token.popularity}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chain Info */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        Chain
                      </h3>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Chain</span>
                          <span className="text-white font-medium">{token.chain.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Chain ID</span>
                          <span className="text-white font-mono bg-gray-800/50 px-2 py-0.5 rounded">{token.chainId}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Native Symbol</span>
                          <span className="text-white">{token.chain.symbol}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contract Address */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        Contract
                      </h3>
                      <div className="text-sm">
                        {token.isNative ? (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                            <span className="text-blue-400 text-xs font-medium">Native Token</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                            <code className="text-green-400 text-xs flex-1 truncate">
                              {token.address}
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(token.address, `address-${token.id}`);
                              }}
                              className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
                                copiedField === `address-${token.id}`
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'hover:bg-gray-700 text-gray-400 hover:text-white'
                              }`}
                              title="Copy"
                            >
                              {copiedField === `address-${token.id}` ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {token.tags && token.tags.length > 0 ? (
                          token.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                tag === 'native' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                tag === 'stablecoin' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                tag === 'wrapped' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                tag === 'defi' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                tag === 'meme' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                tag === 'governance' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                                tag === 'lsd' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                tag === 'gaming' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                              }`}
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-600 text-xs">No tags</span>
                        )}
                      </div>
                    </div>

                    {/* External IDs */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        External IDs
                      </h3>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">CoinGecko</span>
                          {token.coingeckoId ? (
                            <span className="text-white font-mono text-xs bg-gray-800/50 px-2 py-1 rounded-md">
                              {token.coingeckoId}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">Not set</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Logo Preview */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-pink-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        Logo
                      </h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          <TokenLogo token={token} size="lg" />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-xs text-gray-400">
                            {token.logoUrl ? 'Custom logo URL' : 'Using fallback (symbol)'}
                          </p>
                          {token.logoUrl && (
                            <p className="text-xs text-gray-600 mt-1 truncate" title={token.logoUrl}>
                              {token.logoUrl}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                    <div className="flex items-center gap-2">
                      {!token.isNative && chain?.trustwalletId && (
                        <a
                          href={`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain.trustwalletId}/assets/${token.address}/logo.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          TrustWallet Logo
                        </a>
                      )}
                      {token.coingeckoId && (
                        <a
                          href={`https://www.coingecko.com/en/coins/${token.coingeckoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          CoinGecko
                        </a>
                      )}
                      {!token.isNative && (
                        <a
                          href={`https://dexscreener.com/search?q=${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          DexScreener
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/tokens/${token.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Token
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTokens.length === 0 && (
          <div className="bg-[#1a1b23] rounded-xl p-12 text-center border border-gray-800">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">No tokens found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <p className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredTokens.length)} of {filteredTokens.length} tokens
          </p>
          
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-[#1a1b23] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-600">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1a1b23] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-[#1a1b23] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
