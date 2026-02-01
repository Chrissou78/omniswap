'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  X,
  Check,
  AlertCircle,
  Loader2,
  Download,
  Image as ImageIcon,
  RefreshCw,
  Shield,
  ChevronDown,
} from 'lucide-react';
import Image from 'next/image';
import type { Token, Chain } from '@/types';
import { CHAINS } from '@/config';
import {
  getAllTokens,
  getTokensByChainId,
  addToken,
  updateToken,
  updateTokenLogo,
  removeToken,
  isAdmin,
  exportTokens,
  exportCustomTokens,
  type AddTokenParams,
} from '@/services/tokenService';
import {
  getTokenLogo,
  autoDetectTokenLogoWithResult,
  exportLogoRegistry,
} from '@/services/logoService';

// ============================================
// Token Logo with Edit
// ============================================

interface EditableTokenLogoProps {
  token: Token;
  size?: number;
  onUpdate: (url: string) => void;
  canEdit: boolean;
}

const EditableTokenLogo: React.FC<EditableTokenLogoProps> = ({
  token,
  size = 40,
  onUpdate,
  canEdit,
}) => {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoUrl = getTokenLogo(token);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      // This would call updateTokenLogo in real implementation
      const reader = new FileReader();
      reader.onload = () => {
        onUpdate(reader.result as string);
        setShowMenu(false);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAutoDetect = async () => {
    setIsLoading(true);
    try {
      const result = await autoDetectTokenLogoWithResult(token);
      if (result.valid) {
        onUpdate(result.url);
      }
    } finally {
      setIsLoading(false);
      setShowMenu(false);
    }
  };
  
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
        style={{ width: size, height: size }}
      >
        <Loader2 className="animate-spin text-gray-400" style={{ width: size * 0.5 }} />
      </div>
    );
  }
  
  if (error || !logoUrl) {
    return (
      <div className="relative group">
        <div
          className="flex items-center justify-center rounded-full bg-gradient-to-br from-gray-400 to-gray-600 text-white font-bold"
          style={{ width: size, height: size, fontSize: size * 0.35 }}
        >
          {token.symbol.slice(0, 2)}
        </div>
        
        {canEdit && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Upload className="text-white" style={{ width: size * 0.4 }} />
          </button>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    );
  }
  
  return (
    <div className="relative group">
      <Image
        src={logoUrl}
        alt={token.symbol}
        width={size}
        height={size}
        className="rounded-full"
        onError={() => setError(true)}
        unoptimized
      />
      
      {canEdit && (
        <>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit2 className="text-white" style={{ width: size * 0.4 }} />
          </button>
          
          {showMenu && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Upload className="w-4 h-4" />
                Upload Image
              </button>
              <button
                onClick={handleAutoDetect}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <RefreshCw className="w-4 h-4" />
                Auto-Detect
              </button>
            </div>
          )}
        </>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

// ============================================
// Add Token Modal
// ============================================

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (params: AddTokenParams) => Promise<void>;
  chains: Chain[];
}

const AddTokenModal: React.FC<AddTokenModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  chains,
}) => {
  const [chainId, setChainId] = useState<number | string>(1);
  const [address, setAddress] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [decimals, setDecimals] = useState(18);
  const [tags, setTags] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const selectedChain = chains.find(c => c.id === chainId);
  
  const resetForm = () => {
    setAddress('');
    setSymbol('');
    setName('');
    setDecimals(18);
    setTags('');
    setLogoUrl('');
    setLogoFile(null);
    setLogoPreview(null);
    setError(null);
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoUrl('');
      
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      await onAdd({
        chainId,
        address: address.trim(),
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        decimals,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        logoUrl: logoUrl.trim() || undefined,
        logoFile: logoFile || undefined,
      });
      
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add New Token</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Chain Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chain
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowChainDropdown(!showChainDropdown)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-left"
              >
                <span className="text-gray-900 dark:text-white">
                  {selectedChain?.name || 'Select chain'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              
              {showChainDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  {chains.map(chain => (
                    <button
                      key={chain.id}
                      type="button"
                      onClick={() => {
                        setChainId(chain.id);
                        setShowChainDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                    >
                      <span className="text-gray-900 dark:text-white">{chain.name}</span>
                      <span className="text-gray-500 text-sm">{chain.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contract Address
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="0x..."
              required
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Symbol & Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Symbol
              </label>
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                placeholder="ETH"
                required
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Decimals
              </label>
              <input
                type="number"
                value={decimals}
                onChange={e => setDecimals(parseInt(e.target.value) || 18)}
                min={0}
                max={24}
                required
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ethereum"
              required
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="defi, stablecoin, governance"
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo
            </label>
            
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 overflow-hidden"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={logoUrl}
                  onChange={e => {
                    setLogoUrl(e.target.value);
                    setLogoFile(null);
                    setLogoPreview(e.target.value);
                  }}
                  placeholder="https://... or upload"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-xs text-gray-500">
                  Click preview to upload, or paste URL. Leave empty for auto-detect.
                </p>
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </form>
        
        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !address || !symbol || !name}
            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Token
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Token Manager Component
// ============================================

const TokenManager: React.FC = () => {
  const { address: walletAddress } = useAccount();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedChain, setSelectedChain] = useState<number | string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  
  // Check admin status
  useEffect(() => {
    setIsAdminUser(walletAddress ? isAdmin(walletAddress) : false);
  }, [walletAddress]);
  
  // Load tokens
  useEffect(() => {
    const loadTokens = () => {
      if (selectedChain === 'all') {
        setTokens(getAllTokens());
      } else {
        setTokens(getTokensByChainId(selectedChain));
      }
    };
    loadTokens();
  }, [selectedChain]);
  
  // Filter tokens
  const filteredTokens = tokens.filter(token => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    );
  });
  
  // Handle add token
  const handleAddToken = async (params: AddTokenParams) => {
    if (!walletAddress) throw new Error('Wallet not connected');
    await addToken(params, walletAddress);
    
    // Refresh list
    if (selectedChain === 'all') {
      setTokens(getAllTokens());
    } else {
      setTokens(getTokensByChainId(selectedChain));
    }
  };
  
  // Handle update logo
  const handleUpdateLogo = async (token: Token, url: string) => {
    if (!walletAddress) return;
    
    try {
      await updateTokenLogo(token.chainId, token.address, { url }, walletAddress);
      
      // Refresh list
      if (selectedChain === 'all') {
        setTokens(getAllTokens());
      } else {
        setTokens(getTokensByChainId(selectedChain));
      }
    } catch (err) {
      console.error('Failed to update logo:', err);
    }
  };
  
  // Handle delete token
  const handleDeleteToken = async (token: Token) => {
    if (!walletAddress) return;
    if (!confirm(`Delete ${token.symbol}?`)) return;
    
    try {
      removeToken(token.chainId, token.address, walletAddress);
      
      // Refresh list
      if (selectedChain === 'all') {
        setTokens(getAllTokens());
      } else {
        setTokens(getTokensByChainId(selectedChain));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete token');
    }
  };
  
  // Export handlers
  const handleExportTokens = () => {
    const data = exportTokens();
    downloadJson(data, 'tokens.json');
  };
  
  const handleExportLogos = () => {
    const data = exportLogoRegistry();
    downloadJson(data, 'logos.json');
  };
  
  const downloadJson = (data: string, filename: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Not admin
  if (!isAdminUser) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Admin Access Required
        </h2>
        <p className="text-gray-500 max-w-md">
          Connect an admin wallet to manage tokens and logos.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Manager</h1>
          <p className="text-gray-500 mt-1">Add, edit, and manage token listings</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportTokens}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Tokens
          </button>
          <button
            onClick={handleExportLogos}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Logos
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Token
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Chain filter */}
        <select
          value={String(selectedChain)}
          onChange={e => setSelectedChain(e.target.value === 'all' ? 'all' : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Chains</option>
          {CHAINS.map(chain => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
        
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tokens..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      
      {/* Token List */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Decimals
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredTokens.map(token => {
                const chain = CHAINS.find(c => c.id === token.chainId);
                return (
                  <tr key={`${token.chainId}-${token.address}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <EditableTokenLogo
                          token={token}
                          size={36}
                          onUpdate={(url) => handleUpdateLogo(token, url)}
                          canEdit={true}
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {token.symbol}
                          </div>
                          <div className="text-sm text-gray-500">{token.name}</div>
                        </div>
                        {token.isCustom && (
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full">
                            Custom
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 dark:text-white">{chain?.name || token.chainId}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm text-gray-500 font-mono">
                        {token.address === 'native' ? 'Native' : `${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 dark:text-white">{token.decimals}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {token.tags?.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {token.isCustom && (
                        <button
                          onClick={() => handleDeleteToken(token)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredTokens.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No tokens found
          </div>
        )}
      </div>
      
      {/* Add Token Modal */}
      <AddTokenModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddToken}
        chains={CHAINS}
      />
    </div>
  );
};

export default TokenManager;

