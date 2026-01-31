// apps/web/src/services/logoService.ts

import type { Token, Chain } from '@/types';
import logosRegistry from '@/config/logos.json';
import chainsData from '@/config/chains.json';

// ============================================================================
// CONSTANTS
// ============================================================================

const TRUSTWALLET_CDN = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const COIN_LOGOS_CDN = 'https://coin-logos.simplr.sh';
const CUSTOM_LOGOS_KEY = 'omniswap_custom_logos';

// ============================================================================
// DYNAMIC CHAIN MAP (from chains.json)
// ============================================================================

// Build TrustWallet chain map dynamically from chains.json
function getTrustWalletChainMap(): Record<string | number, string> {
  const chains = chainsData.chains as Chain[];
  const map: Record<string | number, string> = {};
  
  for (const chain of chains) {
    if (chain.trustwalletId) {
      map[chain.id] = chain.trustwalletId;
    }
  }
  
  return map;
}

// Get chain by ID from chains.json
function getChainById(chainId: string | number): Chain | undefined {
  const chains = chainsData.chains as Chain[];
  return chains.find(c => c.id === chainId || c.id.toString() === chainId.toString());
}

// ============================================================================
// LOCAL STORAGE
// ============================================================================

interface CustomLogos {
  chains: Record<string, string>;
  tokens: Record<string, string>;
}

function getCustomLogos(): CustomLogos {
  if (typeof window === 'undefined') {
    return { chains: {}, tokens: {} };
  }
  try {
    const stored = localStorage.getItem(CUSTOM_LOGOS_KEY);
    return stored ? JSON.parse(stored) : { chains: {}, tokens: {} };
  } catch {
    return { chains: {}, tokens: {} };
  }
}

function saveCustomLogos(logos: CustomLogos): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_LOGOS_KEY, JSON.stringify(logos));
}

// ============================================================================
// CHAIN LOGOS
// ============================================================================

export function getChainLogo(chainId: string | number): string {
  const id = String(chainId);
  const registry = logosRegistry as { chains: Record<string, string>; tokens: Record<string, string> };
  
  // 1. Check custom logos first (user overrides)
  const customLogos = getCustomLogos();
  if (customLogos.chains[id]) {
    return customLogos.chains[id];
  }
  
  // 2. Check logos.json registry
  if (registry.chains[id]) {
    return registry.chains[id];
  }
  
  // 3. Get chain from chains.json and use trustwalletId
  const chain = getChainById(chainId);
  if (chain?.trustwalletId) {
    return `${TRUSTWALLET_CDN}/${chain.trustwalletId}/info/logo.png`;
  }
  
  // 4. Try coin-logos CDN by chain symbol
  if (chain?.symbol) {
    return `${COIN_LOGOS_CDN}/${chain.symbol.toLowerCase()}.png`;
  }
  
  // 5. Default fallback
  return `${COIN_LOGOS_CDN}/eth.png`;
}

export function setChainLogo(chainId: string | number, url: string): void {
  const customLogos = getCustomLogos();
  customLogos.chains[String(chainId)] = url;
  saveCustomLogos(customLogos);
}

export function deleteChainLogo(chainId: string | number): void {
  const customLogos = getCustomLogos();
  delete customLogos.chains[String(chainId)];
  saveCustomLogos(customLogos);
}

// ============================================================================
// TOKEN LOGOS
// ============================================================================

export function getTokenLogo(token: Token): string {
  const tokenKey = `${token.chainId}-${token.address}`;
  const tokenKeyLower = `${token.chainId}-${token.address.toLowerCase()}`;
  const registry = logosRegistry as { chains: Record<string, string>; tokens: Record<string, string> };
  
  // 1. Check custom logos first (user overrides)
  const customLogos = getCustomLogos();
  if (customLogos.tokens[tokenKey]) {
    return customLogos.tokens[tokenKey];
  }
  if (customLogos.tokens[tokenKeyLower]) {
    return customLogos.tokens[tokenKeyLower];
  }
  
  // 2. Check logos.json registry
  if (registry.tokens[tokenKey]) {
    return registry.tokens[tokenKey];
  }
  if (registry.tokens[tokenKeyLower]) {
    return registry.tokens[tokenKeyLower];
  }
  
  // 3. Check token's own logoURI (from tokens.json)
  if (token.logoURI) {
    return token.logoURI;
  }
  
  // 4. For native tokens, use chain logo
  if (token.address === 'native' || token.address === '0x0000000000000000000000000000000000000000') {
    return getChainLogo(token.chainId);
  }
  
  // 5. Try TrustWallet token assets using chain's trustwalletId
  const chain = getChainById(token.chainId);
  if (chain?.trustwalletId && token.address && token.address !== 'native') {
    return `${TRUSTWALLET_CDN}/${chain.trustwalletId}/assets/${token.address}/logo.png`;
  }
  
  // 6. Try coin-logos by symbol
  return `${COIN_LOGOS_CDN}/${token.symbol.toLowerCase()}.png`;
}

export function setTokenLogo(chainId: string | number, address: string, url: string): void {
  const customLogos = getCustomLogos();
  customLogos.tokens[`${chainId}-${address}`] = url;
  saveCustomLogos(customLogos);
}

export function deleteTokenLogo(chainId: string | number, address: string): void {
  const customLogos = getCustomLogos();
  delete customLogos.tokens[`${chainId}-${address}`];
  saveCustomLogos(customLogos);
}

// ============================================================================
// AUTO-DETECT
// ============================================================================

export async function autoDetectTokenLogoUrl(
  chainId: string | number,
  address: string,
  symbol: string
): Promise<string | null> {
  const chain = getChainById(chainId);
  
  const sources: (() => string | null)[] = [
    // TrustWallet (using trustwalletId from chains.json)
    () => {
      if (chain?.trustwalletId && address !== 'native') {
        return `${TRUSTWALLET_CDN}/${chain.trustwalletId}/assets/${address}/logo.png`;
      }
      return null;
    },
    // 1inch
    () => `https://tokens.1inch.io/${address.toLowerCase()}.png`,
    // Coin logos by symbol
    () => `${COIN_LOGOS_CDN}/${symbol.toLowerCase()}.png`,
    // CryptoCompare
    () => `https://www.cryptocompare.com/media/37746238/${symbol.toLowerCase()}.png`,
  ];

  for (const getUrl of sources) {
    const url = getUrl();
    if (url) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          return url;
        }
      } catch {
        continue;
      }
    }
  }
  
  return null;
}

// Alias for tokenService
export const autoDetectTokenLogo = autoDetectTokenLogoUrl;

// Function for TokenManager component (returns { valid: boolean; url: string })
export async function autoDetectTokenLogoWithResult(
  token: Token
): Promise<{ valid: boolean; url: string }> {
  const result = await autoDetectTokenLogoUrl(token.chainId, token.address, token.symbol);
  return {
    valid: result !== null,
    url: result || '',
  };
}

export async function autoDetectChainLogo(chainId: string | number): Promise<string | null> {
  const chain = getChainById(chainId);
  
  if (chain?.trustwalletId) {
    const url = `${TRUSTWALLET_CDN}/${chain.trustwalletId}/info/logo.png`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch {
      // Continue to fallback
    }
  }
  
  // Try coin-logos by symbol
  if (chain?.symbol) {
    const url = `${COIN_LOGOS_CDN}/${chain.symbol.toLowerCase()}.png`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch {
      // Continue
    }
  }
  
  return null;
}

// ============================================================================
// UPLOAD
// ============================================================================

export async function uploadLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }
    
    if (file.size > 500 * 1024) {
      reject(new Error('File must be less than 500KB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 128, 128);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Could not create canvas context'));
        }
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAndSetTokenLogo(
  file: File,
  chainId: string | number,
  address: string
): Promise<string> {
  const base64 = await uploadLogo(file);
  setTokenLogo(chainId, address, base64);
  return base64;
}

export async function uploadAndSetChainLogo(
  file: File,
  chainId: string | number
): Promise<string> {
  const base64 = await uploadLogo(file);
  setChainLogo(chainId, base64);
  return base64;
}

// ============================================================================
// EXPORT
// ============================================================================

export function exportLogosRegistry(): { chains: Record<string, string>; tokens: Record<string, string> } {
  const customLogos = getCustomLogos();
  const registry = logosRegistry as { chains: Record<string, string>; tokens: Record<string, string> };
  
  return {
    chains: { ...registry.chains, ...customLogos.chains },
    tokens: { ...registry.tokens, ...customLogos.tokens },
  };
}

// Alias for TokenManager (returns JSON string)
export const exportLogoRegistry = (): string => {
  return JSON.stringify(exportLogosRegistry(), null, 2);
};

export function clearCustomLogos(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CUSTOM_LOGOS_KEY);
}
