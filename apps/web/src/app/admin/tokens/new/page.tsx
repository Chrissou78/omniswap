// apps/web/src/app/admin/tokens/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Chain {
  id: string;
  name: string;
  symbol: string;
  trustwalletId?: string | null;
}

export default function NewTokenPage() {
  const router = useRouter();
  const [chains, setChains] = useState<Chain[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    chainId: '1',
    address: '',
    symbol: '',
    name: '',
    decimals: 18,
    logoUrl: '',
    coingeckoId: '',
    popularity: 50,
    isNative: false,
    isStablecoin: false,
    tags: '',
  });

  useEffect(() => {
    fetchChains();
  }, []);

  const fetchChains = async () => {
    try {
      const res = await fetch('/api/admin/chains');
      if (res.ok) {
        const data = await res.json();
        setChains(data);
        if (data.length > 0 && !formData.chainId) {
          setFormData(prev => ({ ...prev, chainId: String(data[0].id) }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch chains:', error);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const fetchTokenInfo = async () => {
    if (!formData.address || formData.address.length < 20) return;
    setIsFetching(true);
    setError('');

    try {
      const platformMap: Record<string, string> = {
        '1': 'ethereum',
        '56': 'binance-smart-chain',
        '137': 'polygon-pos',
        '42161': 'arbitrum-one',
        '10': 'optimistic-ethereum',
        '8453': 'base',
        '43114': 'avalanche',
      };
      const platform = platformMap[formData.chainId];
      if (!platform) {
        setError('Auto-fetch not supported for this chain');
        setIsFetching(false);
        return;
      }

      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${formData.address.toLowerCase()}`
      );
      if (!res.ok) throw new Error('Token not found on CoinGecko');

      const data = await res.json();
      setFormData((prev) => ({
        ...prev,
        symbol: data.symbol?.toUpperCase() || prev.symbol,
        name: data.name || prev.name,
        decimals: data.detail_platforms?.[platform]?.decimal_place || prev.decimals,
        logoUrl: data.image?.small || prev.logoUrl,
        coingeckoId: data.id || prev.coingeckoId,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!formData.symbol || !formData.name) {
        throw new Error('Symbol and Name are required');
      }
      if (!formData.isNative && !formData.address) {
        throw new Error('Address required for non-native tokens');
      }

      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          address: formData.isNative ? 'native' : formData.address,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create token');
      }

      // Success - redirect to tokens list
      window.location.href = '/admin/tokens';
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const selectedChain = chains.find(c => String(c.id) === formData.chainId);

  // Build TrustWallet URL for display
  const trustwalletUrl = selectedChain?.trustwalletId && !formData.isNative && formData.address
    ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${selectedChain.trustwalletId}/assets/${formData.address}/logo.png`
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Add New Token</h1>
        <Link href="/admin/tokens" className="text-gray-400 hover:text-white">
          ← Back to Tokens
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Chain & Address */}
        <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Chain & Contract</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Chain <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.chainId}
                  onChange={(e) => updateField('chainId', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>{chain.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isNative}
                    onChange={(e) => {
                      updateField('isNative', e.target.checked);
                      if (e.target.checked) updateField('address', '');
                    }}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                  />
                  <span className="text-white">Native Token</span>
                </label>
              </div>
            </div>

            {!formData.isNative && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Contract Address <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder="0x..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={fetchTokenInfo}
                    disabled={isFetching || !formData.address}
                    className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    {isFetching ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                    Fetch
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-1">Click Fetch to auto-fill from CoinGecko</p>
              </div>
            )}
          </div>
        </div>

        {/* Token Info */}
        <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Token Information</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Symbol <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => updateField('symbol', e.target.value.toUpperCase())}
                  placeholder="ETH"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Ethereum"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Decimals</label>
                <input
                  type="number"
                  value={formData.decimals}
                  onChange={(e) => updateField('decimals', parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">CoinGecko ID</label>
                <input
                  type="text"
                  value={formData.coingeckoId}
                  onChange={(e) => updateField('coingeckoId', e.target.value)}
                  placeholder="ethereum"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Popularity & Status */}
        <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Popularity & Status</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Popularity (0-100): {formData.popularity}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.popularity}
                  onChange={(e) => updateField('popularity', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.popularity}
                  onChange={(e) => updateField('popularity', parseInt(e.target.value) || 0)}
                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1">Higher values appear first in token lists</p>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isStablecoin}
                  onChange={(e) => updateField('isStablecoin', e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                />
                <span className="text-white">Stablecoin</span>
              </label>
            </div>
          </div>
        </div>

        {/* Logo & Tags */}
        <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Logo & Tags</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Logo URL</label>
              <div className="flex gap-3 items-center">
                <div className="flex-1 min-w-0">
                  <input
                    type="url"
                    value={formData.logoUrl}
                    onChange={(e) => updateField('logoUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                {formData.logoUrl && (
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="w-10 h-10 rounded-full flex-shrink-0 bg-gray-700"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
              {trustwalletUrl && (
                <div className="mt-2 p-2 bg-gray-800/50 rounded-lg overflow-hidden">
                  <p className="text-gray-500 text-xs mb-1">TrustWallet URL:</p>
                  <p className="text-gray-400 text-xs truncate" title={trustwalletUrl}>
                    {trustwalletUrl}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => updateField('tags', e.target.value)}
                placeholder="defi, governance, meme, wrapped, lsd, gaming"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-gray-500 text-xs mt-1">Common tags: native, stablecoin, wrapped, defi, meme, governance, lsd, gaming</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isSubmitting ? 'Creating...' : 'Create Token'}
          </button>

          <Link
            href="/admin/tokens"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
