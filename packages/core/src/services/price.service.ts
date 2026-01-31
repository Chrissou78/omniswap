import axios from 'axios';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

export interface PriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: Date;
}

export class PriceService {
  private redis: Redis;
  private readonly CACHE_TTL = 30; // 30 seconds
  private readonly TOKEN_INFO_TTL = 3600; // 1 hour

  // CoinGecko chain ID mapping
  private readonly COINGECKO_PLATFORMS: Record<number, string> = {
    1: 'ethereum',
    56: 'binance-smart-chain',
    137: 'polygon-pos',
    42161: 'arbitrum-one',
    10: 'optimistic-ethereum',
    8453: 'base',
    43114: 'avalanche',
  };

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async getTokenPrice(chainId: number, tokenAddress: string): Promise<number | null> {
    const cacheKey = `price:${chainId}:${tokenAddress.toLowerCase()}`;
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return parseFloat(cached);
    }

    try {
      let price: number | null = null;

      if (chainId === 101) {
        // Solana - Use Jupiter price API
        price = await this.getSolanaTokenPrice(tokenAddress);
      } else if (chainId === 784) {
        // Sui - Use Cetus or custom API
        price = await this.getSuiTokenPrice(tokenAddress);
      } else {
        // EVM - Use CoinGecko
        price = await this.getEVMTokenPrice(chainId, tokenAddress);
      }

      if (price !== null) {
        await this.redis.setex(cacheKey, this.CACHE_TTL, price.toString());
      }

      return price;
    } catch (error) {
      logger.error('Failed to get token price', { chainId, tokenAddress, error });
      return null;
    }
  }

  async getTokenPrices(
    tokens: Array<{ chainId: number; address: string }>
  ): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    
    // Group by chain for batch requests
    const byChain = new Map<number, string[]>();
    
    for (const token of tokens) {
      const existing = byChain.get(token.chainId) || [];
      existing.push(token.address);
      byChain.set(token.chainId, existing);
    }

    // Fetch prices for each chain
    await Promise.all(
      Array.from(byChain.entries()).map(async ([chainId, addresses]) => {
        for (const address of addresses) {
          const price = await this.getTokenPrice(chainId, address);
          if (price !== null) {
            prices[`${chainId}:${address.toLowerCase()}`] = price;
          }
        }
      })
    );

    return prices;
  }

  async getTokenInfo(chainId: number, tokenAddress: string): Promise<TokenInfo | null> {
    const cacheKey = `tokeninfo:${chainId}:${tokenAddress.toLowerCase()}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      let info: TokenInfo | null = null;

      if (chainId === 101) {
        info = await this.getSolanaTokenInfo(tokenAddress);
      } else if (chainId === 784) {
        info = await this.getSuiTokenInfo(tokenAddress);
      } else {
        info = await this.getEVMTokenInfo(chainId, tokenAddress);
      }

      if (info) {
        await this.redis.setex(cacheKey, this.TOKEN_INFO_TTL, JSON.stringify(info));
      }

      return info;
    } catch (error) {
      logger.error('Failed to get token info', { chainId, tokenAddress, error });
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // EVM Price Fetching
  // --------------------------------------------------------------------------

  private async getEVMTokenPrice(chainId: number, tokenAddress: string): Promise<number | null> {
    const platform = this.COINGECKO_PLATFORMS[chainId];
    if (!platform) {
      return null;
    }

    // Handle native tokens
    if (tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      return this.getNativeTokenPrice(chainId);
    }

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/${platform}`,
        {
          params: {
            contract_addresses: tokenAddress,
            vs_currencies: 'usd',
          },
          timeout: 10000,
        }
      );

      const data = response.data[tokenAddress.toLowerCase()];
      return data?.usd || null;
    } catch (error) {
      // Fallback to DeFiLlama
      return this.getDefiLlamaPrice(chainId, tokenAddress);
    }
  }

  private async getNativeTokenPrice(chainId: number): Promise<number | null> {
    const coinIds: Record<number, string> = {
      1: 'ethereum',
      56: 'binancecoin',
      137: 'matic-network',
      42161: 'ethereum',
      10: 'ethereum',
      8453: 'ethereum',
      43114: 'avalanche-2',
    };

    const coinId = coinIds[chainId];
    if (!coinId) return null;

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price`,
        {
          params: {
            ids: coinId,
            vs_currencies: 'usd',
          },
          timeout: 10000,
        }
      );

      return response.data[coinId]?.usd || null;
    } catch {
      return null;
    }
  }

  private async getDefiLlamaPrice(chainId: number, tokenAddress: string): Promise<number | null> {
    const chainNames: Record<number, string> = {
      1: 'ethereum',
      56: 'bsc',
      137: 'polygon',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base',
      43114: 'avax',
    };

    const chain = chainNames[chainId];
    if (!chain) return null;

    try {
      const response = await axios.get(
        `https://coins.llama.fi/prices/current/${chain}:${tokenAddress}`,
        { timeout: 10000 }
      );

      const key = `${chain}:${tokenAddress}`;
      return response.data.coins[key]?.price || null;
    } catch {
      return null;
    }
  }

  private async getEVMTokenInfo(chainId: number, tokenAddress: string): Promise<TokenInfo | null> {
    // Try CoinGecko first
    const platform = this.COINGECKO_PLATFORMS[chainId];
    if (!platform) return null;

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${tokenAddress}`,
        { timeout: 10000 }
      );

      const data = response.data;
      return {
        address: tokenAddress,
        symbol: data.symbol?.toUpperCase() || '',
        name: data.name || '',
        decimals: data.detail_platforms?.[platform]?.decimal_place || 18,
        logoURI: data.image?.small,
        chainId,
      };
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Solana Price Fetching
  // --------------------------------------------------------------------------

  private async getSolanaTokenPrice(mintAddress: string): Promise<number | null> {
    try {
      const response = await axios.get(
        `https://price.jup.ag/v6/price?ids=${mintAddress}`,
        { timeout: 10000 }
      );

      return response.data.data[mintAddress]?.price || null;
    } catch {
      return null;
    }
  }

  private async getSolanaTokenInfo(mintAddress: string): Promise<TokenInfo | null> {
    try {
      const response = await axios.get(
        `https://tokens.jup.ag/token/${mintAddress}`,
        { timeout: 10000 }
      );

      const data = response.data;
      return {
        address: mintAddress,
        symbol: data.symbol || '',
        name: data.name || '',
        decimals: data.decimals || 9,
        logoURI: data.logoURI,
        chainId: 101,
      };
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Sui Price Fetching
  // --------------------------------------------------------------------------

  private async getSuiTokenPrice(coinType: string): Promise<number | null> {
    try {
      // Use Cetus API or other Sui price oracle
      const response = await axios.get(
        `https://api-sui.cetus.zone/v2/sui/token-price`,
        {
          params: { coinType },
          timeout: 10000,
        }
      );

      return response.data.data?.price || null;
    } catch {
      return null;
    }
  }

  private async getSuiTokenInfo(coinType: string): Promise<TokenInfo | null> {
    try {
      const response = await axios.get(
        `https://api-sui.cetus.zone/v2/sui/tokens`,
        { timeout: 10000 }
      );

      const token = response.data.data?.tokens?.find(
        (t: any) => t.address === coinType
      );

      if (!token) return null;

      return {
        address: coinType,
        symbol: token.symbol || '',
        name: token.name || '',
        decimals: token.decimals || 9,
        logoURI: token.logoURI,
        chainId: 784,
      };
    } catch {
      return null;
    }
  }
}
