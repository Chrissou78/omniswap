// packages/core/src/services/goplus.service.ts
import axios, { AxiosInstance } from 'axios';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

export interface GoPlusTokenSecurityResponse {
  code: number;
  message: string;
  result: Record<string, GoPlusTokenSecurity>;
}

export interface GoPlusTokenSecurity {
  // Basic Info
  token_name: string;
  token_symbol: string;
  total_supply: string;
  holder_count: string;

  // Ownership
  owner_address: string;
  owner_balance: string;
  owner_percent: string;
  creator_address: string;
  creator_balance: string;
  creator_percent: string;

  // Risks
  is_honeypot: string;
  is_open_source: string;
  is_proxy: string;
  is_mintable: string;
  can_take_back_ownership: string;
  owner_change_balance: string;
  hidden_owner: string;
  selfdestruct: string;
  external_call: string;

  // Trading
  buy_tax: string;
  sell_tax: string;
  slippage_modifiable: string;
  personal_slippage_modifiable: string;
  trading_cooldown: string;
  transfer_pausable: string;
  cannot_buy: string;
  cannot_sell_all: string;

  // Access Control
  is_blacklisted: string;
  is_whitelisted: string;
  is_in_dex: string;

  // Anti-Whale
  is_anti_whale: string;
  anti_whale_modifiable: string;
  
  // Liquidity
  lp_holder_count: string;
  lp_total_supply: string;
  lp_holders?: GoPlusLPHolder[];
  dex?: GoPlusDexInfo[];
  holders?: GoPlusHolder[];

  // Trust List
  trust_list: string;

  // Other
  other_potential_risks?: string;
  note?: string;
}

export interface GoPlusLPHolder {
  address: string;
  tag?: string;
  is_contract: number;
  balance: string;
  percent: string;
  is_locked: number;
}

export interface GoPlusDexInfo {
  name: string;
  liquidity: string;
  pair: string;
}

export interface GoPlusHolder {
  address: string;
  tag?: string;
  is_contract: number;
  balance: string;
  percent: string;
  is_locked: number;
}

export interface TokenAudit {
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  risks: TokenRisk[];
  isHoneypot: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasBlacklist: boolean;
  hasWhitelist: boolean;
  canTakeBackOwnership: boolean;
  ownerChangeBalance: boolean;
  hiddenOwner: boolean;
  selfDestruct: boolean;
  externalCall: boolean;
  buyTax: string;
  sellTax: string;
  holders: number;
  lpHolders: number;
  totalSupply: string;
  creatorAddress: string;
  creatorPercent: string;
  ownerAddress: string;
  ownerPercent: string;
  lpTotalSupply: string;
  lpLockedPercent: string;
  dexInfo: Array<{ name: string; liquidity: string; pair: string }>;
  topHolders: Array<{
    address: string;
    balance: string;
    percent: string;
    isContract: boolean;
    isLocked: boolean;
    tag?: string;
  }>;
  antiWhale?: {
    isAntiWhale: boolean;
    antiWhaleModifiable: boolean;
  };
  tradingCooldown?: string;
  slippageModifiable: boolean;
  personalSlippageModifiable: boolean;
  transferPausable: boolean;
  cannotBuy: boolean;
  cannotSellAll: boolean;
  lastUpdated: string;
}

export interface TokenRisk {
  code: string;
  name: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

// Chain ID mapping for GoPlus
const GOPLUS_CHAIN_IDS: Record<string, string> = {
  '1': '1',           // Ethereum
  '56': '56',         // BSC
  '137': '137',       // Polygon
  '42161': '42161',   // Arbitrum
  '10': '10',         // Optimism
  '8453': '8453',     // Base
  '43114': '43114',   // Avalanche
  '250': '250',       // Fantom
  '25': '25',         // Cronos
  '100': '100',       // Gnosis
  'solana-mainnet': 'solana',
};

// Risk definitions
const RISK_DEFINITIONS: Record<string, Omit<TokenRisk, 'code'>> = {
  is_honeypot: {
    name: 'Honeypot Detected',
    description: 'This token cannot be sold after purchase. This is a critical risk.',
    severity: 'critical',
  },
  hidden_owner: {
    name: 'Hidden Owner',
    description: 'The contract has a hidden owner who can control the token.',
    severity: 'critical',
  },
  can_take_back_ownership: {
    name: 'Retrievable Ownership',
    description: 'The previous owner can reclaim ownership of the contract.',
    severity: 'high',
  },
  owner_change_balance: {
    name: 'Owner Can Modify Balances',
    description: 'The owner can modify token balances at will.',
    severity: 'critical',
  },
  selfdestruct: {
    name: 'Self Destruct',
    description: 'The contract can be self-destructed, making the token worthless.',
    severity: 'critical',
  },
  is_mintable: {
    name: 'Mintable',
    description: 'New tokens can be minted, potentially diluting value.',
    severity: 'medium',
  },
  is_proxy: {
    name: 'Proxy Contract',
    description: 'This is a proxy contract. The implementation can be changed.',
    severity: 'medium',
  },
  external_call: {
    name: 'External Calls',
    description: 'The contract makes external calls which could be exploited.',
    severity: 'medium',
  },
  transfer_pausable: {
    name: 'Transfer Pausable',
    description: 'Token transfers can be paused by the owner.',
    severity: 'high',
  },
  is_blacklisted: {
    name: 'Blacklist Function',
    description: 'Addresses can be blacklisted from trading.',
    severity: 'medium',
  },
  is_whitelisted: {
    name: 'Whitelist Function',
    description: 'Only whitelisted addresses may trade.',
    severity: 'medium',
  },
  slippage_modifiable: {
    name: 'Modifiable Slippage',
    description: 'Trading slippage/tax can be modified by the owner.',
    severity: 'high',
  },
  cannot_buy: {
    name: 'Cannot Buy',
    description: 'Token cannot be purchased.',
    severity: 'critical',
  },
  cannot_sell_all: {
    name: 'Cannot Sell All',
    description: 'You may not be able to sell all your tokens.',
    severity: 'high',
  },
  high_buy_tax: {
    name: 'High Buy Tax',
    description: 'Buy tax exceeds 10%.',
    severity: 'high',
  },
  high_sell_tax: {
    name: 'High Sell Tax',
    description: 'Sell tax exceeds 10%.',
    severity: 'high',
  },
  extreme_buy_tax: {
    name: 'Extreme Buy Tax',
    description: 'Buy tax exceeds 50%.',
    severity: 'critical',
  },
  extreme_sell_tax: {
    name: 'Extreme Sell Tax',
    description: 'Sell tax exceeds 50%.',
    severity: 'critical',
  },
  low_holder_count: {
    name: 'Low Holder Count',
    description: 'Token has fewer than 100 holders.',
    severity: 'medium',
  },
  low_lp_locked: {
    name: 'Low Liquidity Locked',
    description: 'Less than 50% of liquidity is locked.',
    severity: 'high',
  },
  no_lp_locked: {
    name: 'No Liquidity Locked',
    description: 'No liquidity is locked. High rug pull risk.',
    severity: 'critical',
  },
  high_owner_percent: {
    name: 'High Owner Holdings',
    description: 'Owner holds more than 10% of supply.',
    severity: 'medium',
  },
  extreme_owner_percent: {
    name: 'Extreme Owner Holdings',
    description: 'Owner holds more than 50% of supply.',
    severity: 'high',
  },
};

export class GoPlusService {
  private client: AxiosInstance;
  private redis: Redis;
  private logger: Logger;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BATCH_SIZE = 100;

  constructor(redis: Redis) {
    this.redis = redis;
    this.logger = new Logger('GoPlusService');

    this.client = axios.create({
      baseURL: 'https://api.gopluslabs.io/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get token security audit
   */
  async getTokenSecurity(
    chainId: string,
    tokenAddress: string
  ): Promise<TokenAudit | null> {
    const goPlusChainId = GOPLUS_CHAIN_IDS[chainId];
    if (!goPlusChainId) {
      this.logger.warn(`Unsupported chain for GoPlus: ${chainId}`);
      return null;
    }

    // Check cache first
    const cacheKey = `goplus:token:${chainId}:${tokenAddress.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await this.client.get<GoPlusTokenSecurityResponse>(
        `/token_security/${goPlusChainId}`,
        {
          params: { contract_addresses: tokenAddress.toLowerCase() },
        }
      );

      if (response.data.code !== 1 || !response.data.result) {
        this.logger.warn(`GoPlus API error: ${response.data.message}`);
        return null;
      }

      const rawData = response.data.result[tokenAddress.toLowerCase()];
      if (!rawData) {
        return null;
      }

      const audit = this.transformAuditData(rawData);

      // Cache the result
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(audit));

      return audit;
    } catch (error) {
      this.logger.error('Failed to fetch GoPlus token security', error);
      return null;
    }
  }

  /**
   * Batch get token security for multiple tokens
   */
  async batchGetTokenSecurity(
    chainId: string,
    tokenAddresses: string[]
  ): Promise<Map<string, TokenAudit>> {
    const results = new Map<string, TokenAudit>();
    const goPlusChainId = GOPLUS_CHAIN_IDS[chainId];

    if (!goPlusChainId) {
      return results;
    }

    // Check cache first
    const uncached: string[] = [];
    for (const address of tokenAddresses) {
      const cacheKey = `goplus:token:${chainId}:${address.toLowerCase()}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        results.set(address.toLowerCase(), JSON.parse(cached));
      } else {
        uncached.push(address);
      }
    }

    if (uncached.length === 0) {
      return results;
    }

    // Batch fetch uncached tokens (max 100 per request)
    for (let i = 0; i < uncached.length; i += this.BATCH_SIZE) {
      const batch = uncached.slice(i, i + this.BATCH_SIZE);
      try {
        const response = await this.client.get<GoPlusTokenSecurityResponse>(
          `/token_security/${goPlusChainId}`,
          {
            params: { contract_addresses: batch.map((a) => a.toLowerCase()).join(',') },
          }
        );

        if (response.data.code === 1 && response.data.result) {
          for (const [address, rawData] of Object.entries(response.data.result)) {
            const audit = this.transformAuditData(rawData);
            results.set(address.toLowerCase(), audit);

            // Cache
            const cacheKey = `goplus:token:${chainId}:${address.toLowerCase()}`;
            await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(audit));
          }
        }
      } catch (error) {
        this.logger.error(`Failed to batch fetch GoPlus data for batch ${i}`, error);
      }
    }

    return results;
  }

  /**
   * Get address security info
   */
  async getAddressSecurity(chainId: string, address: string): Promise<{
    isBlacklisted: boolean;
    isPhishing: boolean;
    isMalicious: boolean;
    tags: string[];
  } | null> {
    const goPlusChainId = GOPLUS_CHAIN_IDS[chainId];
    if (!goPlusChainId) {
      return null;
    }

    const cacheKey = `goplus:address:${chainId}:${address.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await this.client.get(`/address_security/${address}`, {
        params: { chain_id: goPlusChainId },
      });

      if (response.data.code !== 1) {
        return null;
      }

      const data = response.data.result;
      const result = {
        isBlacklisted: data.blacklist_doubt === '1' || data.blackmail_activities === '1',
        isPhishing: data.phishing_activities === '1',
        isMalicious:
          data.stealing_attack === '1' ||
          data.fake_token === '1' ||
          data.contract_address === '1',
        tags: [] as string[],
      };

      if (data.data_source) {
        result.tags = data.data_source.split(',');
      }

      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch address security', error);
      return null;
    }
  }

  /**
   * Transform raw GoPlus data to our audit format
   */
  private transformAuditData(data: GoPlusTokenSecurity): TokenAudit {
    const risks = this.analyzeRisks(data);
    const riskScore = this.calculateRiskScore(risks, data);
    const riskLevel = this.determineRiskLevel(riskScore);

    // Calculate LP locked percentage
    let lpLockedPercent = '0';
    if (data.lp_holders && data.lp_holders.length > 0) {
      const lockedPercent = data.lp_holders
        .filter((h) => h.is_locked === 1)
        .reduce((sum, h) => sum + parseFloat(h.percent || '0'), 0);
      lpLockedPercent = lockedPercent.toFixed(2);
    }

    return {
      riskLevel,
      riskScore,
      risks,
      isHoneypot: data.is_honeypot === '1',
      isMintable: data.is_mintable === '1',
      isProxy: data.is_proxy === '1',
      hasBlacklist: data.is_blacklisted === '1',
      hasWhitelist: data.is_whitelisted === '1',
      canTakeBackOwnership: data.can_take_back_ownership === '1',
      ownerChangeBalance: data.owner_change_balance === '1',
      hiddenOwner: data.hidden_owner === '1',
      selfDestruct: data.selfdestruct === '1',
      externalCall: data.external_call === '1',
      buyTax: data.buy_tax || '0',
      sellTax: data.sell_tax || '0',
      holders: parseInt(data.holder_count || '0', 10),
      lpHolders: parseInt(data.lp_holder_count || '0', 10),
      totalSupply: data.total_supply || '0',
      creatorAddress: data.creator_address || '',
      creatorPercent: data.creator_percent || '0',
      ownerAddress: data.owner_address || '',
      ownerPercent: data.owner_percent || '0',
      lpTotalSupply: data.lp_total_supply || '0',
      lpLockedPercent,
      dexInfo: (data.dex || []).map((d) => ({
        name: d.name,
        liquidity: d.liquidity,
        pair: d.pair,
      })),
      topHolders: (data.holders || []).slice(0, 10).map((h) => ({
        address: h.address,
        balance: h.balance,
        percent: h.percent,
        isContract: h.is_contract === 1,
        isLocked: h.is_locked === 1,
        tag: h.tag,
      })),
      antiWhale: data.is_anti_whale
        ? {
            isAntiWhale: data.is_anti_whale === '1',
            antiWhaleModifiable: data.anti_whale_modifiable === '1',
          }
        : undefined,
      tradingCooldown: data.trading_cooldown,
      slippageModifiable: data.slippage_modifiable === '1',
      personalSlippageModifiable: data.personal_slippage_modifiable === '1',
      transferPausable: data.transfer_pausable === '1',
      cannotBuy: data.cannot_buy === '1',
      cannotSellAll: data.cannot_sell_all === '1',
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Analyze risks from raw data
   */
  private analyzeRisks(data: GoPlusTokenSecurity): TokenRisk[] {
    const risks: TokenRisk[] = [];

    // Critical risks
    if (data.is_honeypot === '1') {
      risks.push({ code: 'is_honeypot', ...RISK_DEFINITIONS.is_honeypot });
    }
    if (data.hidden_owner === '1') {
      risks.push({ code: 'hidden_owner', ...RISK_DEFINITIONS.hidden_owner });
    }
    if (data.owner_change_balance === '1') {
      risks.push({ code: 'owner_change_balance', ...RISK_DEFINITIONS.owner_change_balance });
    }
    if (data.selfdestruct === '1') {
      risks.push({ code: 'selfdestruct', ...RISK_DEFINITIONS.selfdestruct });
    }
    if (data.cannot_buy === '1') {
      risks.push({ code: 'cannot_buy', ...RISK_DEFINITIONS.cannot_buy });
    }

    // High risks
    if (data.can_take_back_ownership === '1') {
      risks.push({ code: 'can_take_back_ownership', ...RISK_DEFINITIONS.can_take_back_ownership });
    }
    if (data.transfer_pausable === '1') {
      risks.push({ code: 'transfer_pausable', ...RISK_DEFINITIONS.transfer_pausable });
    }
    if (data.slippage_modifiable === '1') {
      risks.push({ code: 'slippage_modifiable', ...RISK_DEFINITIONS.slippage_modifiable });
    }
    if (data.cannot_sell_all === '1') {
      risks.push({ code: 'cannot_sell_all', ...RISK_DEFINITIONS.cannot_sell_all });
    }

    // Tax risks
    const buyTax = parseFloat(data.buy_tax || '0');
    const sellTax = parseFloat(data.sell_tax || '0');
    
    if (buyTax > 50) {
      risks.push({ code: 'extreme_buy_tax', ...RISK_DEFINITIONS.extreme_buy_tax });
    } else if (buyTax > 10) {
      risks.push({ code: 'high_buy_tax', ...RISK_DEFINITIONS.high_buy_tax });
    }
    
    if (sellTax > 50) {
      risks.push({ code: 'extreme_sell_tax', ...RISK_DEFINITIONS.extreme_sell_tax });
    } else if (sellTax > 10) {
      risks.push({ code: 'high_sell_tax', ...RISK_DEFINITIONS.high_sell_tax });
    }

    // Medium risks
    if (data.is_mintable === '1') {
      risks.push({ code: 'is_mintable', ...RISK_DEFINITIONS.is_mintable });
    }
    if (data.is_proxy === '1') {
      risks.push({ code: 'is_proxy', ...RISK_DEFINITIONS.is_proxy });
    }
    if (data.external_call === '1') {
      risks.push({ code: 'external_call', ...RISK_DEFINITIONS.external_call });
    }
    if (data.is_blacklisted === '1') {
      risks.push({ code: 'is_blacklisted', ...RISK_DEFINITIONS.is_blacklisted });
    }
    if (data.is_whitelisted === '1') {
      risks.push({ code: 'is_whitelisted', ...RISK_DEFINITIONS.is_whitelisted });
    }

    // Holder-based risks
    const holderCount = parseInt(data.holder_count || '0', 10);
    if (holderCount < 100) {
      risks.push({ code: 'low_holder_count', ...RISK_DEFINITIONS.low_holder_count });
    }

    // Owner percentage risks
    const ownerPercent = parseFloat(data.owner_percent || '0');
    if (ownerPercent > 50) {
      risks.push({ code: 'extreme_owner_percent', ...RISK_DEFINITIONS.extreme_owner_percent });
    } else if (ownerPercent > 10) {
      risks.push({ code: 'high_owner_percent', ...RISK_DEFINITIONS.high_owner_percent });
    }

    // LP lock risks
    if (data.lp_holders) {
      const lockedPercent = data.lp_holders
        .filter((h) => h.is_locked === 1)
        .reduce((sum, h) => sum + parseFloat(h.percent || '0'), 0);

      if (lockedPercent === 0) {
        risks.push({ code: 'no_lp_locked', ...RISK_DEFINITIONS.no_lp_locked });
      } else if (lockedPercent < 50) {
        risks.push({ code: 'low_lp_locked', ...RISK_DEFINITIONS.low_lp_locked });
      }
    }

    return risks;
  }

  /**
   * Calculate overall risk score (0-100, higher = more risky)
   */
  private calculateRiskScore(risks: TokenRisk[], data: GoPlusTokenSecurity): number {
    let score = 0;

    // Base score from risks
    for (const risk of risks) {
      switch (risk.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 8;
          break;
        case 'low':
          score += 3;
          break;
        case 'info':
          score += 1;
          break;
      }
    }

    // Positive factors (reduce score)
    if (data.is_open_source === '1') {
      score -= 5;
    }
    if (data.trust_list === '1') {
      score -= 10;
    }
    if (parseInt(data.holder_count || '0', 10) > 1000) {
      score -= 5;
    }
    if (data.is_in_dex === '1') {
      score -= 3;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): TokenAudit['riskLevel'] {
    if (score >= 60) return 'critical';
    if (score >= 40) return 'high';
    if (score >= 20) return 'medium';
    if (score >= 5) return 'low';
    return 'safe';
  }

  /**
   * Clear cached data for a token
   */
  async clearCache(chainId: string, tokenAddress: string): Promise<void> {
    const cacheKey = `goplus:token:${chainId}:${tokenAddress.toLowerCase()}`;
    await this.redis.del(cacheKey);
  }
}
