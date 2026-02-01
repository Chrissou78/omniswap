'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, RefreshCw } from 'lucide-react';
import { 
  autoDetectTokenLogoWithResult, 
  autoDetectChainLogo, 
  uploadAndSetTokenLogo,
  deleteTokenLogo,
  getTokenLogo,
  getChainLogo,
} from '@/services/logoService';

// Local type for logo detection result
type LogoResult = { valid?: boolean; url: string; source?: string; isCustom?: boolean };
import { Token, Chain } from '@/types';

// ============================================
// Token Logo Component
// ============================================

interface TokenLogoProps {
  token: Token;
  size?: number;
  className?: string;
  editable?: boolean;
  onLogoChange?: (url: string) => void;
}

export const TokenLogo: React.FC<TokenLogoProps> = ({
  token,
  size = 32,
  className = '',
  editable = false,
  onLogoChange,
}) => {
  const [logoResult, setLogoResult] = useState<LogoResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const cacheKey = `${token.chainId}-${token.address}`;
  
  useEffect(() => {
    let mounted = true;
    
    const detectLogo = async () => {
      setIsLoading(true);
      setError(false);
      
      try {
        // First check if token has explicit logoURI
        if (token.logoURI) {
          setLogoResult({
            url: token.logoURI,
            source: 'explicit',
            isCustom: false,
          });
          setIsLoading(false);
          return;
        }
        
        // Auto-detect
        const result = await autoDetectTokenLogoWithResult(token);
        if (mounted) {
          setLogoResult(result);
          if (result.url && onLogoChange) {
            onLogoChange(result.url);
          }
        }
      } catch (e) {
        if (mounted) setError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    
    detectLogo();
    
    return () => { mounted = false; };
  }, [token.chainId, token.address, token.symbol, token.logoURI]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const url = await uploadAndSetTokenLogo(file, token.chainId, token.address);
      setLogoResult({ url, source: 'custom', isCustom: true });
      setShowUpload(false);
      if (onLogoChange) onLogoChange(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearCustom = () => {
    deleteTokenLogo('token', cacheKey);
    setLogoResult(null);
    // Re-trigger auto-detect
    autoDetectTokenLogoWithResult(token).then(setLogoResult);
  };
  
  const handleRetry = () => {
    setError(false);
    setIsLoading(true);
    autoDetectTokenLogoWithResult(token).then(result => {
      setLogoResult(result);
      setIsLoading(false);
    });
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}
        style={{ width: size, height: size }}
      >
        <Loader2 className="animate-spin text-gray-400" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }
  
  // No logo found - show placeholder with upload option
  if (!logoResult?.url || error) {
    return (
      <div className="relative group">
        <div 
          className={`flex items-center justify-center rounded-full bg-gradient-to-br from-gray-400 to-gray-600 text-white font-bold ${className}`}
          style={{ width: size, height: size, fontSize: size * 0.35 }}
        >
          {token.symbol.slice(0, 2).toUpperCase()}
        </div>
        
        {editable && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Upload className="text-white" style={{ width: size * 0.4, height: size * 0.4 }} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </>
        )}
      </div>
    );
  }
  
  // Logo found
  return (
    <div className="relative group">
      <Image
        src={logoResult.url}
        alt={token.symbol}
        width={size}
        height={size}
        className={`rounded-full ${className}`}
        onError={() => setError(true)}
        unoptimized
      />
      
      {editable && (
        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-white/20 rounded"
            title="Upload custom logo"
          >
            <Upload className="text-white" style={{ width: size * 0.3, height: size * 0.3 }} />
          </button>
          {logoResult.isCustom && (
            <button
              onClick={handleClearCustom}
              className="p-1 hover:bg-white/20 rounded"
              title="Remove custom logo"
            >
              <X className="text-white" style={{ width: size * 0.3, height: size * 0.3 }} />
            </button>
          )}
          {!logoResult.isCustom && error && (
            <button
              onClick={handleRetry}
              className="p-1 hover:bg-white/20 rounded"
              title="Retry auto-detect"
            >
              <RefreshCw className="text-white" style={{ width: size * 0.3, height: size * 0.3 }} />
            </button>
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      {/* Source indicator (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && logoResult.source && (
        <div className="absolute -bottom-1 -right-1 px-1 text-[8px] bg-gray-800 text-white rounded">
          {logoResult.source}
        </div>
      )}
    </div>
  );
};

// ============================================
// Chain Logo Component
// ============================================

interface ChainLogoProps {
  chain: Chain | number | string;
  size?: number;
  className?: string;
  editable?: boolean;
  onLogoChange?: (url: string) => void;
}

export const ChainLogo: React.FC<ChainLogoProps> = ({
  chain,
  size = 24,
  className = '',
  editable = false,
  onLogoChange,
}) => {
  const chainId = typeof chain === 'object' ? chain.id : chain;
  const chainData = typeof chain === 'object' ? chain : null;
  
  const [logoResult, setLogoResult] = useState<LogoResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    let mounted = true;
    
    const detectLogo = async () => {
      setIsLoading(true);
      setError(false);
      
      try {
        const url = await autoDetectChainLogo(chainId);
        if (mounted) {
          if (url) {
            setLogoResult({ url, source: 'auto', isCustom: false });
            if (onLogoChange) {
              onLogoChange(url);
            }
          }
        }
      } catch (e) {
        if (mounted) setError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    
    detectLogo();
    
    return () => { mounted = false; };
  }, [chainId]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const url = await uploadAndSetTokenLogo(file, chainId, 'chain-logo');
      setLogoResult({ url, source: 'custom', isCustom: true });
      if (onLogoChange) onLogoChange(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearCustom = () => {
    deleteTokenLogo('chain', String(chainId));
    setLogoResult(null);
    autoDetectChainLogo(chainId).then(setLogoResult);
  };
  
  // Loading
  if (isLoading) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}
        style={{ width: size, height: size }}
      >
        <Loader2 className="animate-spin text-gray-400" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }
  
  // No logo
  if (!logoResult?.url || error) {
    const symbol = chainData?.symbol || '?';
    const color = chainData?.color || '#627EEA';
    
    return (
      <div className="relative group">
        <div 
          className={`flex items-center justify-center rounded-full text-white font-bold ${className}`}
          style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
        >
          {symbol.slice(0, 2)}
        </div>
        
        {editable && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Upload className="text-white" style={{ width: size * 0.4, height: size * 0.4 }} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </>
        )}
      </div>
    );
  }
  
  // Logo found
  return (
    <div className="relative group">
      <Image
        src={logoResult.url}
        alt={chainData?.name || 'Chain'}
        width={size}
        height={size}
        className={`rounded-full ${className}`}
        onError={() => setError(true)}
        unoptimized
      />
      
      {editable && (
        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-0.5 hover:bg-white/20 rounded"
          >
            <Upload className="text-white" style={{ width: size * 0.35, height: size * 0.35 }} />
          </button>
          {logoResult.isCustom && (
            <button
              onClick={handleClearCustom}
              className="p-0.5 hover:bg-white/20 rounded"
            >
              <X className="text-white" style={{ width: size * 0.35, height: size * 0.35 }} />
            </button>
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};








