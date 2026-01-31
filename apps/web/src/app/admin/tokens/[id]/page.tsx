// apps/web/src/app/admin/tokens/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Token {
  id: string;
  chainId: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
  coingeckoId: string;
  isActive: boolean;
  isNative: boolean;
  isStablecoin: boolean;
  popularity: number;
  tags: string[];
  chain: { id: string; name: string; symbol: string } | null;
}

export default function EditTokenPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    symbol: '',
    name: '',
    decimals: 18,
    logoUrl: '',
    coingeckoId: '',
    isActive: true,
    isStablecoin: false,
    popularity: 50,
    tags: '',
  });

  useEffect(() => {
    if (id) {
      fetchToken();
    }
  }, [id]);

  const fetchToken = async () => {
    try {
      const res = await fetch(`/api/admin/tokens/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setToken(data);
        setForm({
          symbol: data.symbol || '',
          name: data.name || '',
          decimals: data.decimals || 18,
          logoUrl: data.logoUrl || '',
          coingeckoId: data.coingeckoId || '',
          isActive: data.isActive !== false,
          isStablecoin: data.isStablecoin || false,
          popularity: data.popularity || 50,
          tags: (data.tags || []).join(', '),
        });
      } else {
        setError('Token not found');
      }
    } catch (err) {
      setError('Failed to load token');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/tokens/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save token');
      }

      // Success - redirect to tokens list using window.location for guaranteed redirect
      window.location.href = '/admin/tokens';
    } catch (err: any) {
      setError(err.message || 'Failed to save token');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this token?')) return;

    try {
      const res = await fetch(`/api/admin/tokens/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        window.location.href = '/admin/tokens';
      } else {
        setError('Failed to delete token');
      }
    } catch (err) {
      setError('Failed to delete token');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-1/3"></div>
          <div className="h-32 bg-gray-800 rounded-xl"></div>
          <div className="h-64 bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error && !token) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/admin/tokens" className="text-blue-400 hover:text-blue-300">
          ← Back to Tokens
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {form.logoUrl && (
            <img
              src={form.logoUrl}
              alt={form.symbol}
              className="w-10 h-10 rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Token</h1>
            <p className="text-gray-400 text-sm">{token?.symbol} on {token?.chain?.name}</p>
          </div>
        </div>
        <Link href="/admin/tokens" className="text-gray-400 hover:text-white">
          ← Back to Tokens
        </Link>
      </div>

      {/* Token Info (Read-only) */}
      <div className="bg-[#1a1b23] rounded-xl p-4 mb-6 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          Token Identity (Read-only)
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block mb-1">Chain</span>
            <span className="text-white font-medium">{token?.chain?.name || token?.chainId}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Chain ID</span>
            <span className="text-white font-mono bg-gray-800/50 px-2 py-0.5 rounded">{token?.chainId}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500 block mb-1">Contract Address</span>
            {token?.isNative ? (
              <span className="inline-block px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium">
                Native Token
              </span>
            ) : (
              <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2 min-w-0">
                <code className="text-green-400 text-xs truncate flex-1 min-w-0">
                  {token?.address}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(token?.address || '')}
                  className="flex-shrink-0 p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  title="Copy address"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Symbol *</label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Decimals</label>
              <input
                type="number"
                value={form.decimals}
                onChange={(e) => setForm({ ...form, decimals: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">CoinGecko ID</label>
              <input
                type="text"
                value={form.coingeckoId}
                onChange={(e) => setForm({ ...form, coingeckoId: e.target.value })}
                placeholder="ethereum"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Popularity & Status */}
        <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Popularity & Status</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Popularity (0-100): {form.popularity}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  value={form.popularity}
                  onChange={(e) => setForm({ ...form, popularity: parseInt(e.target.value) })}
                  min="0"
                  max="100"
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  value={form.popularity}
                  onChange={(e) => setForm({ ...form, popularity: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1">Higher values appear first in token lists</p>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-white">Active</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isStablecoin}
                  onChange={(e) => setForm({ ...form, isStablecoin: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
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
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                {form.logoUrl && (
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="w-10 h-10 rounded-full flex-shrink-0 bg-gray-700"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="defi, governance, meme, wrapped, lsd, gaming"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-gray-500 text-xs mt-1">Common tags: native, stablecoin, wrapped, defi, meme, governance, lsd, gaming</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Delete Token
          </button>

          <div className="flex gap-4">
            <Link
              href="/admin/tokens"
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
