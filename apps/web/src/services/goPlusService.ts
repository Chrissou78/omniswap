// apps/web/src/services/goPlusService.ts
'use client';

import chainsData from '@/config/chains.json';
import type { Chain } from '@/types';

export interface TokenAuditResult {
  chainId: string | number;
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks: Array<{
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  isHoneypot: boolean;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  buyTax: number;
  sellTax: number;
  liquidity: Array<{
    dex: string;
    pair: string;
    liquidityUsd: number;
  }>;
  totalLiquidityUsd: number;
  topHolders: Array<{
    address: string;
    percent: number;
    tag?: string;
    isContract?: boolean;
    isLocked?: boolean;
  }>;
  ownerAddress: string;
  creatorAddress: string;
  isTrusted: boolean;
  isVerified: boolean;
}

export interface AuditSummary {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  isHoneypot: boolean;
  hasHighTax: boolean;
}

const GOPLUS_BASE_URL = 'https://api.gopluslabs.io/api/v1';

// ============================================================================
// DYNAMIC CHAIN MAPPING (from chains.json)
// ============================================================================

/**
 * Build GoPlus chain ID map dynamically from chains.json
 * GoPlus uses numeric chain IDs for EVM chains
 */
function getGoPlusChainId(chainId: string | number): string | null {
  const chains = chainsData.chains as Chain[];
  
  // If already numeric, check if it's a supported EVM chain
  if (typeof chainId === 'number' || !isNaN(Number(chainId))) {
    const numericId = String(chainId);
    const chain = chains.find(c => String(c.id) === numericId);
    // GoPlus only supports EVM chains
    if (chain?.type === 'evm') {
      return numericId;
    }
  }
  
  // Try to find chain by string ID
  const chain = chains.find(c => 
    String(c.id).toLowerCase() === String(chainId).toLowerCase() ||
    c.symbol?.toLowerCase() === String(chainId).toLowerCase()
  );
  
  // GoPlus only supports EVM chains with numeric IDs
  if (chain?.type === 'evm' && typeof chain.id === 'number') {
    return String(chain.id);
  }
  
  return null;
}

const CACHE = new Map<string, { data: TokenAuditResult; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

function calculateRiskScore(data: any): number {
  let score = 0;

  if (data.is_honeypot === '1') score += 50;
  if (data.cannot_buy === '1') score += 40;
  if (data.cannot_sell_all === '1') score += 40;
  if (data.owner_change_balance === '1') score += 35;
  if (data.hidden_owner === '1') score += 25;
  if (data.can_take_back_ownership === '1') score += 25;
  if (data.selfdestruct === '1') score += 20;
  if (data.external_call === '1') score += 15;
  if (data.is_mintable === '1') score += 10;
  if (data.is_proxy === '1') score += 8;
  if (data.transfer_pausable === '1') score += 12;

  const buyTax = parseFloat(data.buy_tax || '0') * 100;
  const sellTax = parseFloat(data.sell_tax || '0') * 100;

  if (buyTax > 20) score += 20;
  else if (buyTax > 10) score += 12;
  else if (buyTax > 5) score += 5;

  if (sellTax > 20) score += 20;
  else if (sellTax > 10) score += 12;
  else if (sellTax > 5) score += 5;

  if (data.is_open_source === '1') score -= 10;
  if (data.is_in_dex === '1') score -= 5;
  if (data.trust_list === '1') score -= 10;

  return Math.min(100, Math.max(0, score));
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score <= 10) return 'low';
  if (score <= 30) return 'medium';
  if (score <= 60) return 'high';
  return 'critical';
}

function parseRisks(data: any): TokenAuditResult['risks'] {
  const risks: TokenAuditResult['risks'] = [];

  if (data.is_honeypot === '1') {
    risks.push({ name: 'Honeypot Detected', description: 'This token cannot be sold.', severity: 'critical' });
  }
  if (data.cannot_buy === '1') {
    risks.push({ name: 'Cannot Buy', description: 'Buying is restricted.', severity: 'critical' });
  }
  if (data.cannot_sell_all === '1') {
    risks.push({ name: 'Sell Restriction', description: 'Cannot sell all tokens.', severity: 'high' });
  }
  if (data.owner_change_balance === '1') {
    risks.push({ name: 'Balance Manipulation', description: 'Owner can modify balances.', severity: 'critical' });
  }
  if (data.hidden_owner === '1') {
    risks.push({ name: 'Hidden Owner', description: 'Ownership is obscured.', severity: 'high' });
  }
  if (data.is_mintable === '1') {
    risks.push({ name: 'Mintable', description: 'Supply can be increased.', severity: 'medium' });
  }
  if (data.is_proxy === '1') {
    risks.push({ name: 'Proxy Contract', description: 'Can be upgraded.', severity: 'medium' });
  }
  if (data.transfer_pausable === '1') {
    risks.push({ name: 'Pausable', description: 'Transfers can be paused.', severity: 'medium' });
  }

  const buyTax = parseFloat(data.buy_tax || '0') * 100;
  const sellTax = parseFloat(data.sell_tax || '0') * 100;

  if (buyTax > 10) {
    risks.push({ name: 'High Buy Tax', description: `${buyTax.toFixed(1)}% tax`, severity: buyTax > 20 ? 'high' : 'medium' });
  }
  if (sellTax > 10) {
    risks.push({ name: 'High Sell Tax', description: `${sellTax.toFixed(1)}% tax`, severity: sellTax > 20 ? 'high' : 'medium' });
  }

  return risks;
}

export async function getTokenSecurity(
  chainId: string | number,
  tokenAddress: string
): Promise<TokenAuditResult | null> {
  console.log(`[GoPlus] Called with chainId=${chainId}, address=${tokenAddress}`);

  // Skip native tokens and invalid addresses
  if (!tokenAddress ||
      tokenAddress === 'native' ||
      tokenAddress === '0x' ||
      tokenAddress === '0x0000000000000000000000000000000000000000' ||
      tokenAddress.length < 10) {
    console.log('[GoPlus] Skipping - native or invalid token');
    return null;
  }

  // Get mapped chain ID dynamically
  const mappedChainId = getGoPlusChainId(chainId);
  if (!mappedChainId) {
    console.warn(`[GoPlus] Chain ${chainId} not supported (non-EVM or unknown)`);
    return null;
  }

  const normalizedAddress = tokenAddress.toLowerCase();
  const cacheKey = `${mappedChainId}:${normalizedAddress}`;

  // Check cache
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[GoPlus] Cache hit for ${normalizedAddress}`);
    return cached.data;
  }

  try {
    const url = `${GOPLUS_BASE_URL}/token_security/${mappedChainId}?contract_addresses=${normalizedAddress}`;
    console.log(`[GoPlus] Fetching: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    console.log(`[GoPlus] Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[GoPlus] HTTP error: ${response.status}`);
      return null;
    }

    const json = await response.json();
    console.log(`[GoPlus] Response code: ${json.code}, message: ${json.message}`);

    if (json.code !== 1 || !json.result) {
      console.warn('[GoPlus] Invalid response');
      return null;
    }

    const data = json.result[normalizedAddress];
    if (!data) {
      console.warn(`[GoPlus] No data for address ${normalizedAddress}`);
      const altData = json.result[tokenAddress];
      if (!altData) {
        console.warn('[GoPlus] No data with original address either');
        return null;
      }
    }

    const tokenData = data || json.result[tokenAddress];

    // Parse liquidity
    let totalLiquidityUsd = 0;
    const liquidityPools: TokenAuditResult['liquidity'] = [];

    if (tokenData.dex && Array.isArray(tokenData.dex)) {
      for (const pool of tokenData.dex) {
        const liquidity = parseFloat(pool.liquidity || '0');
        totalLiquidityUsd += liquidity;
        if (liquidity > 100) {
          liquidityPools.push({
            dex: pool.name || 'Unknown',
            pair: pool.pair || '',
            liquidityUsd: liquidity,
          });
        }
      }
      liquidityPools.sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    }

    // Parse holders
    const topHolders: TokenAuditResult['topHolders'] = [];
    if (tokenData.holders && Array.isArray(tokenData.holders)) {
      for (const holder of tokenData.holders.slice(0, 10)) {
        topHolders.push({
          address: holder.address,
          percent: parseFloat(holder.percent || '0') * 100,
          tag: holder.tag || undefined,
          isContract: holder.is_contract === 1,
          isLocked: holder.is_locked === 1,
        });
      }
    }

    const riskScore = calculateRiskScore(tokenData);
    const riskLevel = getRiskLevel(riskScore);

    const result: TokenAuditResult = {
      chainId,
      address: tokenAddress,
      name: tokenData.token_name || 'Unknown',
      symbol: tokenData.token_symbol || '???',
      totalSupply: tokenData.total_supply || '0',
      holderCount: parseInt(tokenData.holder_count || '0'),
      riskScore,
      riskLevel,
      risks: parseRisks(tokenData),
      isHoneypot: tokenData.is_honeypot === '1',
      isOpenSource: tokenData.is_open_source === '1',
      isProxy: tokenData.is_proxy === '1',
      isMintable: tokenData.is_mintable === '1',
      buyTax: parseFloat(tokenData.buy_tax || '0') * 100,
      sellTax: parseFloat(tokenData.sell_tax || '0') * 100,
      liquidity: liquidityPools.slice(0, 10),
      totalLiquidityUsd,
      topHolders,
      ownerAddress: tokenData.owner_address || '',
      creatorAddress: tokenData.creator_address || '',
      isTrusted: tokenData.trust_list === '1' || (tokenData.is_in_cex?.listed === '1'),
      isVerified: tokenData.is_open_source === '1',
    };

    console.log(`[GoPlus] SUCCESS: ${result.symbol} - Risk: ${result.riskLevel} (${result.riskScore}/100), Holders: ${result.holderCount}`);

    CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('[GoPlus] Fetch error:', error);
    return null;
  }
}

export async function getAuditSummary(
  chainId: string | number,
  tokenAddress: string
): Promise<AuditSummary | null> {
  const audit = await getTokenSecurity(chainId, tokenAddress);
  if (!audit) return null;

  return {
    riskLevel: audit.riskLevel,
    riskScore: audit.riskScore,
    isHoneypot: audit.isHoneypot,
    hasHighTax: audit.buyTax > 10 || audit.sellTax > 10,
  };
}
