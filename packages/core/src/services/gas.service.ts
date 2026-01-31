// packages/core/src/services/gas.service.ts

import { SUPPORTED_CHAINS } from '@omniswap/types';

interface GasServiceConfig {
  cacheTTL: number;
}

interface GasPrice {
  slow: string;
  standard: string;
  fast: string;
  instant: string;
  baseFee?: string;
}

export class GasService {
  private cache: Map<string, { gasPrice: GasPrice; timestamp: number }> = new Map();
  private config: GasServiceConfig;

  constructor(config: GasServiceConfig) {
    this.config = config;
  }

  /**
   * Get gas prices for a chain
   */
  async getGasPrice(chainId: string): Promise<GasPrice | null> {
    const cached = this.cache.get(chainId);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL * 1000) {
      return cached.gasPrice;
    }

    // In production, fetch from RPC or gas API
    // For now, return defaults
    const defaultGas: GasPrice = {
      slow: '10000000000',      // 10 gwei
      standard: '20000000000',  // 20 gwei
      fast: '30000000000',      // 30 gwei
      instant: '50000000000',   // 50 gwei
    };

    this.cache.set(chainId, { gasPrice: defaultGas, timestamp: Date.now() });
    return defaultGas;
  }

  /**
   * Estimate gas cost in USD
   */
  async estimateGasCostUsd(
    chainId: string,
    gasLimit: string,
    speed: 'slow' | 'standard' | 'fast' | 'instant' = 'standard'
  ): Promise<number> {
    const gasPrice = await this.getGasPrice(chainId);
    if (!gasPrice) return 0;

    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) return 0;

    const gasCost = BigInt(gasLimit) * BigInt(gasPrice[speed]);
    
    // In production, multiply by native token price
    // For now, assume ETH = $3000
    const ethPrice = 3000;
    const gasCostEth = Number(gasCost) / 1e18;
    
    return gasCostEth * ethPrice;
  }
}
