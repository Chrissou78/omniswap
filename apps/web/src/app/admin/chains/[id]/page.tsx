// apps/web/src/app/admin/chains/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface TrustWalletResult {
  trustwalletId: string | null;
  logoUrl: string | null;
  chainInfo: {
    name?: string;
    symbol?: string;
    decimals?: number;
    explorer?: string;
  } | null;
  found: boolean;
}

interface ChainForm {
  id: string;
  name: string;
  symbol: string;
  type: string;
  color: string;
  // RPC
  rpcEnvKey: string;
  rpcDefault: string;
  // Explorer
  explorerUrl: string;
  explorerName: string;
  // External IDs
  trustwalletId: string;
  dexscreenerId: string;
  defillamaId: string;
  // Wrapped native
  wrappedNativeAddress: string;
  // Settings
  popularity: number;
  isActive: boolean;
  isTestnet: boolean;
}

const DEFAULT_FORM: ChainForm = {
  id: '',
  name: '',
  symbol: '',
  type: 'evm',
  color: '#627EEA',
  rpcEnvKey: '',
  rpcDefault: '',
  explorerUrl: '',
  explorerName: '',
  trustwalletId: '',
  dexscreenerId: '',
  defillamaId: '',
  wrappedNativeAddress: '',
  popularity: 50,
  isActive: true,
  isTestnet: false,
};

export default function EditChainPage() {
  const router = useRouter();
  const params = useParams();
  const chainId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [trustwalletResult, setTrustwalletResult] = useState<TrustWalletResult | null>(null);
  const [formData, setFormData] = useState<ChainForm>(DEFAULT_FORM);

  // Fetch existing chain data
  useEffect(() => {
    const fetchChain = async () => {
      try {
        const res = await fetch(`/api/admin/chains/${chainId}`);
        if (res.ok) {
          const data = await res.json();
          setFormData({
            id: String(data.id || ''),
            name: data.name || '',
            symbol: data.symbol || '',
            type: data.type?.toLowerCase() || 'evm',
            color: data.color || '#627EEA',
            rpcEnvKey: data.rpcEnvKey || '',
            rpcDefault: data.rpcDefault || data.rpcUrl || '',
            explorerUrl: data.explorerUrl || '',
            explorerName: data.explorerName || '',
            trustwalletId: data.trustwalletId || '',
            dexscreenerId: data.dexscreenerId || '',
            defillamaId: data.defillamaId || '',
            wrappedNativeAddress: data.wrappedNativeAddress || '',
            popularity: data.popularity ?? 50,
            isActive: data.isActive ?? true,
            isTestnet: data.isTestnet ?? false,
          });
        } else {
          setError('Chain not found');
        }
      } catch (err) {
        setError('Failed to load chain');
      } finally {
        setLoading(false);
      }
    };

    fetchChain();
  }, [chainId]);

  // TrustWallet search (manual trigger for edit mode)
  const searchTrustWallet = async () => {
    if (!formData.name && !formData.symbol) return;
    
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (formData.name) params.set('name', formData.name);
      if (formData.symbol) params.set('symbol', formData.symbol);
      
      const response = await fetch(`/api/trustwallet/search?${params}`);
      if (response.ok) {
        const result: TrustWalletResult = await response.json();
        setTrustwalletResult(result);
        
        if (result.found && result.trustwalletId) {
          // Only fill empty fields
          setFormData(prev => ({
            ...prev,
            trustwalletId: prev.trustwalletId || result.trustwalletId || '',
            dexscreenerId: prev.dexscreenerId || result.trustwalletId || '',
            defillamaId: prev.defillamaId || result.trustwalletId || '',
            explorerUrl: prev.explorerUrl || result.chainInfo?.explorer || '',
          }));
        }
      }
    } catch (err) {
      console.error('TrustWallet search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...formData,
        type: formData.type.toUpperCase(),
        trustwalletId: formData.trustwalletId || null,
        dexscreenerId: formData.dexscreenerId || null,
        defillamaId: formData.defillamaId || null,
        wrappedNativeAddress: formData.wrappedNativeAddress || null,
      };

      const response = await fetch(`/api/admin/chains/${chainId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update chain');
      }

      router.push('/admin/chains');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chain');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this chain? This will also remove all associated tokens.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/chains/${chainId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/chains');
      } else {
        setError('Failed to delete chain');
      }
    } catch {
      setError('Failed to delete chain');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
          ? Number(value)
          : value,
    }));
  };

  const previewLogoUrl = formData.trustwalletId
    ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${formData.trustwalletId}/info/logo.png`
    : null;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-700 rounded w-48"></div>
          <div className="h-64 bg-gray-800 rounded-lg"></div>
          <div className="h-48 bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {previewLogoUrl && (
            <img
              src={previewLogoUrl}
              alt={formData.name}
              className="w-10 h-10 rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Chain</h1>
            <p className="text-gray-400 text-sm">{formData.name} ({formData.symbol})</p>
          </div>
        </div>
        <Link href="/admin/chains" className="text-gray-400 hover:text-white">
          ← Back to Chains
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Chain ID</label>
              <input
                type="text"
                name="id"
                value={formData.id}
                disabled
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed"
              />
              <p className="text-gray-500 text-xs mt-1">Cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Type *</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="evm">EVM</option>
                <option value="solana">Solana</option>
                <option value="sui">Sui</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Ethereum, Polygon"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Symbol *</label>
              <input
                type="text"
                name="symbol"
                value={formData.symbol}
                onChange={handleChange}
                required
                placeholder="e.g., ETH, MATIC"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  className="h-10 w-14 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="#627EEA"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RPC Configuration */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">RPC Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">RPC Environment Key *</label>
              <input
                type="text"
                name="rpcEnvKey"
                value={formData.rpcEnvKey}
                onChange={handleChange}
                required
                placeholder="NEXT_PUBLIC_ETH_RPC"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm"
              />
              <p className="text-gray-500 text-xs mt-1">Environment variable name for custom RPC</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Default RPC URL *</label>
              <input
                type="url"
                name="rpcDefault"
                value={formData.rpcDefault}
                onChange={handleChange}
                required
                placeholder="https://..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <p className="text-gray-500 text-xs mt-1">Fallback RPC if env variable not set</p>
            </div>
          </div>
        </div>

        {/* Explorer */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Block Explorer</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Explorer URL *</label>
              <input
                type="url"
                name="explorerUrl"
                value={formData.explorerUrl}
                onChange={handleChange}
                required
                placeholder="https://etherscan.io"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Explorer Name *</label>
              <input
                type="text"
                name="explorerName"
                value={formData.explorerName}
                onChange={handleChange}
                required
                placeholder="Etherscan"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* External Service IDs */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">External Service IDs</h2>
            <button
              type="button"
              onClick={searchTrustWallet}
              disabled={searching}
              className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {searching ? 'Searching...' : 'Auto-detect IDs'}
            </button>
          </div>

          {trustwalletResult && (
            <div className={`mb-4 p-3 rounded-lg ${
              trustwalletResult.found
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-yellow-500/10 border border-yellow-500/30'
            }`}>
              {trustwalletResult.found ? (
                <p className="text-green-400 text-sm">
                  ✓ Found: {trustwalletResult.trustwalletId} - Empty fields auto-filled
                </p>
              ) : (
                <p className="text-yellow-400 text-sm">
                  Not found in TrustWallet. Enter IDs manually.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">TrustWallet ID</label>
              <input
                type="text"
                name="trustwalletId"
                value={formData.trustwalletId}
                onChange={handleChange}
                placeholder="ethereum, smartchain, polygon..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <p className="text-gray-500 text-xs mt-1">For chain/token logos</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">DexScreener ID</label>
              <input
                type="text"
                name="dexscreenerId"
                value={formData.dexscreenerId}
                onChange={handleChange}
                placeholder="ethereum, bsc, polygon..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <p className="text-gray-500 text-xs mt-1">For DEX price data</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">DefiLlama ID</label>
              <input
                type="text"
                name="defillamaId"
                value={formData.defillamaId}
                onChange={handleChange}
                placeholder="ethereum, bsc, avax..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <p className="text-gray-500 text-xs mt-1">For price fallback</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Wrapped Native Address</label>
              <input
                type="text"
                name="wrappedNativeAddress"
                value={formData.wrappedNativeAddress}
                onChange={handleChange}
                placeholder="0x..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm"
              />
              <p className="text-gray-500 text-xs mt-1">WETH, WBNB, etc. for price lookups</p>
            </div>
          </div>
        </div>

        {/* Popularity & Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Popularity & Status</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Popularity (0-100): {formData.popularity}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  name="popularity"
                  value={formData.popularity}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  name="popularity"
                  value={formData.popularity}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-center"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1">Higher values appear first in chain lists</p>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                />
                <span className="text-white">Active</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isTestnet"
                  checked={formData.isTestnet}
                  onChange={handleChange}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                />
                <span className="text-white">Testnet</span>
              </label>
            </div>
          </div>
        </div>

        {/* Logo Preview */}
        {previewLogoUrl && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Logo Preview</h2>
            <div className="flex items-center gap-4">
              <img
                src={previewLogoUrl}
                alt="Chain logo"
                className="w-16 h-16 rounded-full bg-gray-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).className = 'w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center';
                }}
              />
              <div>
                <p className="text-gray-400 text-sm">From TrustWallet Assets</p>
                <p className="text-gray-500 text-xs break-all">{previewLogoUrl}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Delete Chain
          </button>

          <div className="flex gap-4">
            <Link
              href="/admin/chains"
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
