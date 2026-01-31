// packages/core/src/services/goplus.service.ts
import axios from 'axios';
import { RedisClient } from '../utils/redis';

export interface GoPlusTokenSecurity {
  // Basic Info
  token_name: string;
  token_symbol: string;
  total_supply: string;
  holder_count: string;
  
  // Risk Indicators
  is_honeypot: string;           // "0" or "1"
  is_open_source: string;
  is_proxy: string;
  is_mintable: string;
  can_take_back_ownership: string;
  owner_change_balance: string;
  hidden_owner: string;
  selfdestruct: string;
  external_call: string;
  
  // Tax Info
  buy_tax: string;
  sell_tax: string;
  slippage_modifiable: string;
  is_blacklisted: string;
  is_whitelisted: string;
  is_anti_whale: string;
  anti_whale_modifiable: string;
  trading_cooldown: string;
  personal_slippage_modifiable: string;
  
  // Holder Analysis
  lp_holder_count: string;
  lp_total_supply: string;
  is_true_token: string;
  is_airdrop_scam: string;
  trust_list: string;
  
  // DEX Info
  dex: Array<{
    name: string;
    liquidity: string;
    pair: string;
  }>;
  
  // Holders
  holders: Array<{
    address: string;
    tag: string;
    is_contract: number;
    balance: string;
    percent: string;
    is_locked: number;
  }>;
  
  // LP Holders
  lp_holders: Array<{
    address: string;
    tag: string;
    is_contract: number;
    balance: string;
    percent: string;
    is_locked: number;
    locked_detail: Array<{
      amount: string;
      end_time: string;
      opt_time: string;
    }>;
  }>;
  
  // Owner
  owner_address: string;
  creator_address: string;
  creator_balance: string;
  creator_percent: string;
}

export interface GoPlusNFTSecurity {
  nft_name: string;
  nft_symbol: string;
  nft_erc: string;
  total_supply: string;
  highest_price: string;
  lowest_price_24h: string;
  average_price_24h: string;
  sales_24h: string;
  traded_volume_24h: string;
  
  // Risks
  nft_open_source: string;
  nft_proxy: string;
  privileged_burn: string;
  privileged_minting: string;
  self_destruct: string;
  transfer_without_approval: string;
  restricted_approval: string;
  
  // Metadata
  metadata_frozen: string;
  nft_verified: string;
  trust_list: string;
}

export interface TokenAuditResult {
  chainId: number | string;
  address: string;
  timestamp: number;
  
  // Basic Info
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  
  // Risk Score (0-100, higher = riskier)
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Risk Categories
  risks: {
    category: string;
    name: string;
    description: string;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    value: string | boolean;
  }[];
  
  // Summary
  isHoneypot: boolean;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  buyTax: number;
  sellTax: number;
  
  // Liquidity
  liquidity: {
    dex: string;
    pair: string;
    liquidityUsd: number;
  }[];
  totalLiquidityUsd: number;
  
  // Top Holders
  topHolders: {
    address: string;
    percent: number;
    isContract: boolean;
    isLocked: boolean;
    tag?: string;
  }[];
  
  // Contract Info
  ownerAddress: string | null;
  creatorAddress: string;
  creatorPercent: number;
  
  // Trust
  isTrusted: boolean;
  isVerified: boolean;
  
  // Raw data
  raw: GoPlusTokenSecurity;
}

export interface AuditSummary {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  isHoneypot: boolean;
  hasHighTax: boolean;
  isTrusted: boolean;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
}

const GOPLUS_BASE_URL = 'https://api.gopluslabs.io/api/v1';

// Chain ID mapping for GoPlus
const CHAIN_ID_MAP: Record<number | string, string> = {
  1: '1',           // Ethereum
  56: '56',         // BSC
  137: '137',       // Polygon
  42161: '42161',   // Arbitrum
  10: '10',         // Optimism
  8453: '8453',     // Base
  43114: '43114',   // Avalanche
  250: '250',       // Fantom
  25: '25',         // Cronos
  'solana-mainnet': 'solana',
};

export class GoPlusService {
  private redis: RedisClient;
  private cacheTTL = 3600; // 1 hour cache

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  /**
   * Get token security audit from GoPlus
   */
  async getTokenSecurity(
    chainId: number | string,
    tokenAddress: string
  ): Promise<TokenAuditResult | null> {
    const cacheKey = `goplus:token:${chainId}:${tokenAddress.toLowerCase()}`;
    
    // Check cache
    const cached = await this.redis.getJSON<TokenAuditResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const goPlusChainId = CHAIN_ID_MAP[chainId];
    if (!goPlusChainId) {
      console.warn(`GoPlus: Unsupported chain ${chainId}`);
      return null;
    }

    try {
      const response = await axios.get(
        `${GOPLUS_BASE_URL}/token_security/${goPlusChainId}`,
        {
          params: {
            contract_addresses: tokenAddress.toLowerCase(),
          },
          timeout: 10000,
        }
      );

      if (response.data.code !== 1) {
        console.error('GoPlus API error:', response.data.message);
        return null;
      }

      const data = response.data.result[tokenAddress.toLowerCase()];
      if (!data) {
        return null;
      }

      const result = this.parseTokenSecurity(chainId, tokenAddress, data);
      
      // Cache result
      await this.redis.setJSON(cacheKey, result, this.cacheTTL);
      
      return result;
    } catch (error) {
      console.error('GoPlus API request failed:', error);
      return null;
    }
  }

  /**
   * Get audit summary (lightweight version for badges)
   */
  async getAuditSummary(
    chainId: number | string,
    tokenAddress: string
  ): Promise<AuditSummary | null> {
    const audit = await this.getTokenSecurity(chainId, tokenAddress);
    if (!audit) return null;

    return {
      riskLevel: audit.riskLevel,
      riskScore: audit.riskScore,
      isHoneypot: audit.isHoneypot,
      hasHighTax: audit.buyTax > 10 || audit.sellTax > 10,
      isTrusted: audit.isTrusted,
      criticalRisks: audit.risks.filter((r) => r.severity === 'critical').length,
      highRisks: audit.risks.filter((r) => r.severity === 'high').length,
      mediumRisks: audit.risks.filter((r) => r.severity === 'medium').length,
    };
  }

  /**
   * Batch check multiple tokens
   */
  async batchGetTokenSecurity(
    chainId: number | string,
    tokenAddresses: string[]
  ): Promise<Map<string, TokenAuditResult>> {
    const results = new Map<string, TokenAuditResult>();
    const uncached: string[] = [];

    // Check cache first
    for (const address of tokenAddresses) {
      const cacheKey = `goplus:token:${chainId}:${address.toLowerCase()}`;
      const cached = await this.redis.getJSON<TokenAuditResult>(cacheKey);
      if (cached) {
        results.set(address.toLowerCase(), cached);
      } else {
        uncached.push(address);
      }
    }

    if (uncached.length === 0) {
      return results;
    }

    const goPlusChainId = CHAIN_ID_MAP[chainId];
    if (!goPlusChainId) {
      return results;
    }

    try {
      // GoPlus supports up to 100 addresses per request
      const chunks = this.chunkArray(uncached, 100);
      
      for (const chunk of chunks) {
        const response = await axios.get(
          `${GOPLUS_BASE_URL}/token_security/${goPlusChainId}`,
          {
            params: {
              contract_addresses: chunk.join(','),
            },
            timeout: 15000,
          }
        );

        if (response.data.code === 1 && response.data.result) {
          for (const [address, data] of Object.entries(response.data.result)) {
            const result = this.parseTokenSecurity(chainId, address, data as GoPlusTokenSecurity);
            results.set(address.toLowerCase(), result);
            
            // Cache result
            const cacheKey = `goplus:token:${chainId}:${address.toLowerCase()}`;
            await this.redis.setJSON(cacheKey, result, this.cacheTTL);
          }
        }
      }
    } catch (error) {
      console.error('GoPlus batch request failed:', error);
    }

    return results;
  }

  /**
   * Check if address is malicious
   */
  async checkAddress(address: string): Promise<{
    isMalicious: boolean;
    risks: string[];
  }> {
    try {
      const response = await axios.get(
        `${GOPLUS_BASE_URL}/address_security/${address}`,
        { timeout: 10000 }
      );

      if (response.data.code !== 1) {
        return { isMalicious: false, risks: [] };
      }

      const data = response.data.result;
      const risks: string[] = [];

      if (data.cybercrime === '1') risks.push('Associated with cybercrime');
      if (data.money_laundering === '1') risks.push('Money laundering risk');
      if (data.number_of_malicious_contracts_created > 0) {
        risks.push(`Created ${data.number_of_malicious_contracts_created} malicious contracts`);
      }
      if (data.financial_crime === '1') risks.push('Financial crime association');
      if (data.darkweb_transactions === '1') risks.push('Darkweb transactions');
      if (data.phishing_activities === '1') risks.push('Phishing activities');
      if (data.fake_kyc === '1') risks.push('Fake KYC');
      if (data.blacklist_doubt === '1') risks.push('Blacklist suspicion');
      if (data.stealing_attack === '1') risks.push('Stealing attack');
      if (data.blackmail_activities === '1') risks.push('Blackmail activities');
      if (data.sanctioned === '1') risks.push('Sanctioned address');
      if (data.malicious_mining_activities === '1') risks.push('Malicious mining');
      if (data.mixer === '1') risks.push('Mixer usage');
      if (data.honeypot_related_address === '1') risks.push('Honeypot related');

      return {
        isMalicious: risks.length > 0,
        risks,
      };
    } catch (error) {
      console.error('GoPlus address check failed:', error);
      return { isMalicious: false, risks: [] };
    }
  }

  /**
   * Check approval security
   */
  async checkApproval(
    chainId: number | string,
    contractAddress: string
  ): Promise<{
    isRisky: boolean;
    risks: string[];
  }> {
    const goPlusChainId = CHAIN_ID_MAP[chainId];
    if (!goPlusChainId) {
      return { isRisky: false, risks: [] };
    }

    try {
      const response = await axios.get(
        `${GOPLUS_BASE_URL}/approval_security/${goPlusChainId}`,
        {
          params: { contract_addresses: contractAddress },
          timeout: 10000,
        }
      );

      if (response.data.code !== 1) {
        return { isRisky: false, risks: [] };
      }

      const data = response.data.result[contractAddress.toLowerCase()];
      if (!data) {
        return { isRisky: false, risks: [] };
      }

      const risks: string[] = [];

      if (data.is_contract === '0') risks.push('Not a contract (EOA)');
      if (data.is_open_source === '0') risks.push('Contract not open source');
      if (data.trust_list !== '1') risks.push('Not on trust list');
      if (data.is_proxy === '1') risks.push('Proxy contract');
      if (data.doubt_list === '1') risks.push('On doubt list');
      if (data.risky_approval === '1') risks.push('Risky approval pattern');
      if (data.malicious_address === '1') risks.push('Malicious address');

      return {
        isRisky: risks.length > 0,
        risks,
      };
    } catch (error) {
      console.error('GoPlus approval check failed:', error);
      return { isRisky: false, risks: [] };
    }
  }

  /**
   * Parse GoPlus response into structured audit result
   */
  private parseTokenSecurity(
    chainId: number | string,
    address: string,
    data: GoPlusTokenSecurity
  ): TokenAuditResult {
    const risks: TokenAuditResult['risks'] = [];

    // Honeypot check (CRITICAL)
    if (data.is_honeypot === '1') {
      risks.push({
        category: 'honeypot',
        name: 'Honeypot Detected',
        description: 'This token cannot be sold. Do not buy!',
        severity: 'critical',
        value: true,
      });
    }

    // Not open source (HIGH)
    if (data.is_open_source === '0') {
      risks.push({
        category: 'contract',
        name: 'Unverified Contract',
        description: 'Contract source code is not verified',
        severity: 'high',
        value: false,
      });
    }

    // Proxy contract (MEDIUM)
    if (data.is_proxy === '1') {
      risks.push({
        category: 'contract',
        name: 'Proxy Contract',
        description: 'Contract uses proxy pattern - can be upgraded',
        severity: 'medium',
        value: true,
      });
    }

    // Mintable (MEDIUM)
    if (data.is_mintable === '1') {
      risks.push({
        category: 'supply',
        name: 'Mintable Token',
        description: 'New tokens can be minted, potentially diluting value',
        severity: 'medium',
        value: true,
      });
    }

    // Hidden owner (HIGH)
    if (data.hidden_owner === '1') {
      risks.push({
        category: 'ownership',
        name: 'Hidden Owner',
        description: 'Owner address is hidden or obfuscated',
        severity: 'high',
        value: true,
      });
    }

    // Can take back ownership (HIGH)
    if (data.can_take_back_ownership === '1') {
      risks.push({
        category: 'ownership',
        name: 'Ownership Reclaim',
        description: 'Owner can reclaim ownership after renouncing',
        severity: 'high',
        value: true,
      });
    }

    // Owner can change balance (CRITICAL)
    if (data.owner_change_balance === '1') {
      risks.push({
        category: 'ownership',
        name: 'Balance Manipulation',
        description: 'Owner can modify token balances',
        severity: 'critical',
        value: true,
      });
    }

    // Self destruct (CRITICAL)
    if (data.selfdestruct === '1') {
      risks.push({
        category: 'contract',
        name: 'Self Destruct',
        description: 'Contract can be destroyed, making tokens worthless',
        severity: 'critical',
        value: true,
      });
    }

    // External call (MEDIUM)
    if (data.external_call === '1') {
      risks.push({
        category: 'contract',
        name: 'External Calls',
        description: 'Contract makes external calls which could be exploited',
        severity: 'medium',
        value: true,
      });
    }

    // High buy tax (HIGH if > 10%)
    const buyTax = parseFloat(data.buy_tax || '0') * 100;
    if (buyTax > 10) {
      risks.push({
        category: 'tax',
        name: 'High Buy Tax',
        description: `Buy tax is ${buyTax.toFixed(1)}%`,
        severity: buyTax > 30 ? 'critical' : 'high',
        value: `${buyTax.toFixed(1)}%`,
      });
    } else if (buyTax > 5) {
      risks.push({
        category: 'tax',
        name: 'Moderate Buy Tax',
        description: `Buy tax is ${buyTax.toFixed(1)}%`,
        severity: 'medium',
        value: `${buyTax.toFixed(1)}%`,
      });
    }

    // High sell tax (HIGH if > 10%)
    const sellTax = parseFloat(data.sell_tax || '0') * 100;
    if (sellTax > 10) {
      risks.push({
        category: 'tax',
        name: 'High Sell Tax',
        description: `Sell tax is ${sellTax.toFixed(1)}%`,
        severity: sellTax > 30 ? 'critical' : 'high',
        value: `${sellTax.toFixed(1)}%`,
      });
    } else if (sellTax > 5) {
      risks.push({
        category: 'tax',
        name: 'Moderate Sell Tax',
        description: `Sell tax is ${sellTax.toFixed(1)}%`,
        severity: 'medium',
        value: `${sellTax.toFixed(1)}%`,
      });
    }

    // Slippage modifiable (MEDIUM)
    if (data.slippage_modifiable === '1') {
      risks.push({
        category: 'tax',
        name: 'Modifiable Slippage',
        description: 'Tax/slippage can be modified by owner',
        severity: 'medium',
        value: true,
      });
    }

    // Blacklist (MEDIUM)
    if (data.is_blacklisted === '1') {
      risks.push({
        category: 'restrictions',
        name: 'Blacklist Function',
        description: 'Contract has blacklist functionality',
        severity: 'medium',
        value: true,
      });
    }

    // Whitelist (LOW)
    if (data.is_whitelisted === '1') {
      risks.push({
        category: 'restrictions',
        name: 'Whitelist Function',
        description: 'Contract has whitelist functionality',
        severity: 'low',
        value: true,
      });
    }

    // Trading cooldown (LOW)
    if (data.trading_cooldown === '1') {
      risks.push({
        category: 'restrictions',
        name: 'Trading Cooldown',
        description: 'Trading has a cooldown period',
        severity: 'low',
        value: true,
      });
    }

    // Airdrop scam (CRITICAL)
    if (data.is_airdrop_scam === '1') {
      risks.push({
        category: 'scam',
        name: 'Airdrop Scam',
        description: 'Token is likely an airdrop scam',
        severity: 'critical',
        value: true,
      });
    }

    // Not true token (HIGH)
    if (data.is_true_token === '0') {
      risks.push({
        category: 'legitimacy',
        name: 'Fake Token',
        description: 'Token may not be the genuine project',
        severity: 'high',
        value: false,
      });
    }

    // Calculate risk score
    let riskScore = 0;
    for (const risk of risks) {
      switch (risk.severity) {
        case 'critical': riskScore += 30; break;
        case 'high': riskScore += 20; break;
        case 'medium': riskScore += 10; break;
        case 'low': riskScore += 5; break;
        case 'info': riskScore += 1; break;
      }
    }
    riskScore = Math.min(100, riskScore);

    // Determine risk level
    let riskLevel: TokenAuditResult['riskLevel'] = 'low';
    if (riskScore >= 70 || data.is_honeypot === '1') riskLevel = 'critical';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';

    // Parse liquidity
    const liquidity: TokenAuditResult['liquidity'] = (data.dex || []).map((d) => ({
      dex: d.name,
      pair: d.pair,
      liquidityUsd: parseFloat(d.liquidity) || 0,
    }));

    const totalLiquidityUsd = liquidity.reduce((sum, l) => sum + l.liquidityUsd, 0);

    // Parse top holders
    const topHolders: TokenAuditResult['topHolders'] = (data.holders || [])
      .slice(0, 10)
      .map((h) => ({
        address: h.address,
        percent: parseFloat(h.percent) * 100,
        isContract: h.is_contract === 1,
        isLocked: h.is_locked === 1,
        tag: h.tag || undefined,
      }));

    return {
      chainId,
      address: address.toLowerCase(),
      timestamp: Date.now(),
      
      name: data.token_name || '',
      symbol: data.token_symbol || '',
      totalSupply: data.total_supply || '0',
      holderCount: parseInt(data.holder_count || '0', 10),
      
      riskScore,
      riskLevel,
      risks,
      
      isHoneypot: data.is_honeypot === '1',
      isOpenSource: data.is_open_source === '1',
      isProxy: data.is_proxy === '1',
      isMintable: data.is_mintable === '1',
      buyTax,
      sellTax,
      
      liquidity,
      totalLiquidityUsd,
      
      topHolders,
      
      ownerAddress: data.owner_address || null,
      creatorAddress: data.creator_address || '',
      creatorPercent: parseFloat(data.creator_percent || '0') * 100,
      
      isTrusted: data.trust_list === '1',
      isVerified: data.is_open_source === '1',
      
      raw: data,
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
