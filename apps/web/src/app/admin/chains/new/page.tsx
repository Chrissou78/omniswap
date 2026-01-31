// apps/web/src/app/admin/chains/new/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function AddChainPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [trustwalletResult, setTrustwalletResult] = useState<TrustWalletResult | null>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    symbol: '',
    type: 'evm',
    color: '#627EEA',
    // RPC
    rpcEnvKey: '',
    rpcDefault: '',
    // Explorer
    explorerUrl: '',
    explorerName: '',
    // External IDs
    trustwalletId: '',
    dexscreenerId: '',
    defillamaId: '',
    // Wrapped native
    wrappedNativeAddress: '',
    // Settings
    popularity: 50,
    isActive: true,
    isTestnet: false,
  });

  // Auto-generate rpcEnvKey from symbol
  useEffect(() => {
    if (formData.symbol && !formData.rpcEnvKey) {
      setFormData(prev => ({
        ...prev,
        rpcEnvKey: `NEXT_PUBLIC_${prev.symbol.toUpperCase()}_RPC`
      }));
    }
  }, [formData.symbol]);

  // Debounced TrustWallet search when name or symbol changes
  useEffect(() => {
    if (!formData.name && !formData.symbol) {
      setTrustwalletResult(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        if (formData.name) params.set('name', formData.name);
        if (formData.symbol) params.set('symbol', formData.symbol);
        
        const response = await fetch(`/api/trustwallet/search?${params}`);
        if (response.ok) {
          const result: TrustWalletResult = await response.json();
          setTrustwalletResult(result);
          
          // Auto-fill IDs if found and fields are empty
          if (result.found && result.trustwalletId) {
            setFormData(prev => ({
              ...prev,
              trustwalletId: prev.trustwalletId || result.trustwalletId || '',
              // Often the same ID works for other services
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
    }, 600);
    
    return () => clearTimeout(timer);
  }, [formData.name, formData.symbol]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Convert empty strings to null for optional fields
      const payload = {
        ...formData,
        trustwalletId: formData.trustwalletId || null,
        dexscreenerId: formData.dexscreenerId || null,
        defillamaId: formData.defillamaId || null,
        wrappedNativeAddress: formData.wrappedNativeAddress || null,
      };

      const response = await fetch('/api/admin/chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create chain');
      }

      router.push('/admin/chains');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chain');
    } finally {
      setLoading(false);
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

  // Preview logo URL
  const previewLogoUrl = trustwalletResult?.found && trustwalletResult.logoUrl
    ? trustwalletResult.logoUrl
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Add New Chain</h1>
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
              <label className="block text-sm font-medium text-gray-400 mb-1">Chain ID *</label>
              <input
                type="text"
                name="id"
                value={formData.id}
                onChange={handleChange}
                required
                placeholder="e.g., 1, 137, solana-mainnet"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
              <p className="text-gray-500 text-xs mt-1">Numeric for EVM, string for others</p>
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
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Name * {searching && <span className="text-blue-400 text-xs ml-1">(searching...)</span>}
              </label>
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
          <h2 className="text-lg font-semibold text-white mb-4">
            External Service IDs
            {trustwalletResult?.found && (
              <span className="ml-2 text-sm text-green-400 font-normal">✓ Auto-detected</span>
            )}
          </h2>
          
          {trustwalletResult && (
            <div className={`mb-4 p-3 rounded-lg ${
              trustwalletResult.found 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-yellow-500/10 border border-yellow-500/30'
            }`}>
              {trustwalletResult.found ? (
                <div className="flex items-center gap-3">
                  {previewLogoUrl && (
                    <img 
                      src={previewLogoUrl} 
                      alt="Chain logo" 
                      className="w-10 h-10 rounded-full"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <p className="text-green-400 text-sm font-medium">
                      Found: {trustwalletResult.trustwalletId}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Logo and IDs auto-filled from TrustWallet
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-yellow-400 text-sm">
                  Not found in TrustWallet. Enter IDs manually or leave blank if not supported.
                </p>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                TrustWallet ID
              </label>
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
              <label className="block text-sm font-medium text-gray-400 mb-1">
                DexScreener ID
              </label>
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
              <label className="block text-sm font-medium text-gray-400 mb-1">
                DefiLlama ID
              </label>
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
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Wrapped Native Address
              </label>
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
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                />
                <span className="text-white">Active</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isTestnet"
                  checked={formData.isTestnet}
                  onChange={handleChange}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                />
                <span className="text-white">Testnet</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Creating...' : 'Create Chain'}
          </button>
          
          <Link
            href="/admin/chains"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
