// apps/web/src/app/admin/chains/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Chain {
  id: string | number;
  name: string;
  symbol: string;
  color: string;
  type: 'evm' | 'solana' | 'sui';
  trustwalletId?: string | null;
  dexscreenerId?: string | null;
  defillamaId?: string | null;
  wrappedNativeAddress?: string | null;
  rpcEnvKey: string;
  rpcDefault: string;
  explorerUrl: string;
  explorerName: string;
  popularity?: number;
  isActive?: boolean;
  _count?: { tokens: number };
}

// Logo component with proper fallback (no external image request on error)
function ChainLogo({ 
  chain, 
  size = 'md' 
}: { 
  chain: Chain; 
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-lg',
  };

  const logoUrl = chain.trustwalletId
    ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain.trustwalletId}/info/logo.png`
    : null;

  // Reset error state when chain changes
  useEffect(() => {
    setImgError(false);
  }, [chain.id, chain.trustwalletId]);

  const showFallback = !logoUrl || imgError;

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold overflow-hidden`}
      style={{ 
        backgroundColor: chain.color + '33', 
        border: `2px solid ${chain.color}` 
      }}
    >
      {!showFallback ? (
        <img
          src={logoUrl}
          alt={chain.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{chain.symbol.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export default function ChainsPage() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchChains();
  }, []);

  const fetchChains = async () => {
    try {
      const response = await fetch('/api/admin/chains');
      if (response.ok) {
        const data = await response.json();
        setChains(data);
      }
    } catch (error) {
      console.error('Failed to fetch chains:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string | number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredChains = chains.filter(chain => {
    const matchesSearch =
      chain.name.toLowerCase().includes(search.toLowerCase()) ||
      chain.symbol.toLowerCase().includes(search.toLowerCase()) ||
      String(chain.id).includes(search);
    const matchesType = typeFilter === 'all' || chain.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const copyToClipboard = async (text: string, fieldId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Chains</h1>
        </div>
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
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
          <h1 className="text-2xl font-bold text-white">Chains</h1>
          <p className="text-gray-500 text-sm mt-1">{chains.length} chains configured</p>
        </div>
        <Link
          href="/admin/chains/new"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Chain
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, symbol, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1b23] border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#1a1b23] border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="all">All Types</option>
          <option value="evm">EVM</option>
          <option value="solana">Solana</option>
          <option value="sui">Sui</option>
        </select>
      </div>

      {/* Chains List */}
      <div className="space-y-3">
        {filteredChains.map((chain) => {
          const isExpanded = expandedId === chain.id;

          return (
            <div
              key={chain.id}
              className={`bg-[#1a1b23] rounded-xl overflow-hidden transition-all duration-300 border ${
                isExpanded ? 'border-blue-500/50' : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              {/* Main Row - Clickable */}
              <div
                onClick={() => toggleExpand(chain.id)}
                className="flex items-center justify-between p-4 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Logo - Using the new component */}
                  <ChainLogo chain={chain} size="md" />

                  {/* Name & Symbol */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{chain.name}</span>
                      <span className="text-gray-500 text-sm">({chain.symbol})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-0.5">
                      <span className="text-gray-500">ID: {chain.id}</span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        chain.type === 'evm' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        chain.type === 'solana' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      }`}>
                        {chain.type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Quick Stats */}
                  <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      {chain.popularity || 0}
                    </span>
                    {chain._count && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {chain._count.tokens}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    chain.isActive !== false
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {chain.isActive !== false ? 'Active' : 'Inactive'}
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
                  isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
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
                          <span className="text-gray-500">Chain ID</span>
                          <span className="text-white font-mono bg-gray-800/50 px-2 py-0.5 rounded">{chain.id}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Type</span>
                          <span className="text-white">{chain.type.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Symbol</span>
                          <span className="text-white font-semibold">{chain.symbol}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Color</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-md border border-gray-700"
                              style={{ backgroundColor: chain.color }}
                            />
                            <span className="text-gray-400 font-mono text-xs">{chain.color}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Popularity</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${chain.popularity || 0}%` }}
                              />
                            </div>
                            <span className="text-white text-xs">{chain.popularity || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RPC Configuration */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                          </svg>
                        </div>
                        RPC Configuration
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-gray-500 block mb-1.5 text-xs uppercase tracking-wider">Env Key</span>
                          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                            <code className="text-green-400 text-xs flex-1 truncate">
                              {chain.rpcEnvKey}
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(chain.rpcEnvKey, `rpc-env-${chain.id}`);
                              }}
                              className={`p-1.5 rounded-md transition-colors ${
                                copiedField === `rpc-env-${chain.id}`
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'hover:bg-gray-700 text-gray-400 hover:text-white'
                              }`}
                              title="Copy"
                            >
                              {copiedField === `rpc-env-${chain.id}` ? (
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
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1.5 text-xs uppercase tracking-wider">Default RPC</span>
                          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                            <code className="text-blue-400 text-xs flex-1 truncate">
                              {chain.rpcDefault}
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(chain.rpcDefault, `rpc-default-${chain.id}`);
                              }}
                              className={`p-1.5 rounded-md transition-colors ${
                                copiedField === `rpc-default-${chain.id}`
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'hover:bg-gray-700 text-gray-400 hover:text-white'
                              }`}
                              title="Copy"
                            >
                              {copiedField === `rpc-default-${chain.id}` ? (
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
                        </div>
                      </div>
                    </div>

                    {/* Explorer */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        Block Explorer
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Name</span>
                          <span className="text-white font-medium">{chain.explorerName}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1.5 text-xs uppercase tracking-wider">URL</span>
                          <a
                            href={chain.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2 text-purple-400 hover:text-purple-300 transition-colors group"
                          >
                            <span className="text-xs truncate flex-1">{chain.explorerUrl}</span>
                            <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* External Service IDs */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                        </div>
                        External Service IDs
                      </h3>
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">TrustWallet</span>
                          {chain.trustwalletId ? (
                            <span className="text-white font-mono text-xs bg-gray-800/50 px-2 py-1 rounded-md">
                              {chain.trustwalletId}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">Not set</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">DexScreener</span>
                          {chain.dexscreenerId ? (
                            <span className="text-white font-mono text-xs bg-gray-800/50 px-2 py-1 rounded-md">
                              {chain.dexscreenerId}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">Not set</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">DefiLlama</span>
                          {chain.defillamaId ? (
                            <span className="text-white font-mono text-xs bg-gray-800/50 px-2 py-1 rounded-md">
                              {chain.defillamaId}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">Not set</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Wrapped Native Token */}
                    <div className="bg-[#1a1b23] rounded-xl p-4 border border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        Wrapped Native
                      </h3>
                      <div className="text-sm">
                        {chain.wrappedNativeAddress ? (
                          <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                            <code className="text-yellow-400 text-xs flex-1 truncate">
                              {chain.wrappedNativeAddress}
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(chain.wrappedNativeAddress!, `wrapped-${chain.id}`);
                              }}
                              className={`p-1.5 rounded-md transition-colors ${
                                copiedField === `wrapped-${chain.id}`
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'hover:bg-gray-700 text-gray-400 hover:text-white'
                              }`}
                              title="Copy"
                            >
                              {copiedField === `wrapped-${chain.id}` ? (
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
                        ) : (
                          <div className="bg-gray-800/30 rounded-lg p-3 text-center">
                            <span className="text-gray-600 text-xs">Not configured</span>
                          </div>
                        )}
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
                        <ChainLogo chain={chain} size="lg" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-400">
                            {chain.trustwalletId ? 'From TrustWallet CDN' : 'Using fallback (color + symbol)'}
                          </p>
                          {chain.trustwalletId && (
                            <p className="text-xs text-gray-600 mt-1 truncate">
                              blockchains/{chain.trustwalletId}/info/logo.png
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                    <div className="flex items-center gap-2">
                      {chain.dexscreenerId && (
                        <a
                          href={`https://dexscreener.com/${chain.dexscreenerId}`}
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
                      {chain.defillamaId && (
                        <a
                          href={`https://defillama.com/chain/${chain.defillamaId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          DefiLlama
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={chain.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Explorer
                      </a>
                      <Link
                        href={`/admin/chains/${chain.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Chain
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredChains.length === 0 && (
          <div className="bg-[#1a1b23] rounded-xl p-12 text-center border border-gray-800">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">No chains found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}