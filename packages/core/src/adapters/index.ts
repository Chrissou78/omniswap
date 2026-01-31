// packages/core/src/adapters/index.ts

import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult } from './base.adapter';
import { OneInchAdapter } from './evm/oneinch.adapter';
import { LiFiAdapter } from './evm/lifi.adapter';
import { JupiterAdapter } from './solana/jupiter.adapter';
import { CetusAdapter } from './sui/cetus.adapter';
import { MEXCAdapter } from './cex/mexc.adapter';
import { SocketAdapter } from './bridge/socket.adapter';
import { RangoAdapter } from './bridge/rango.adapter';
import { ChangellyAdapter } from './cex/changelly.adapter';
import { ChangeNowAdapter } from './cex/changenow.adapter';

export interface AdapterRegistryConfig {
  oneInch?: {
    apiKey: string;
  };
  lifi?: {
    apiKey?: string;
  };
  jupiter?: {};
  cetus?: {};
  mexc?: {
    apiKey: string;
    secretKey: string;
  };
  socket?: {
    apiKey?: string;
  };
  rango?: {
    apiKey?: string;
  };
  changelly?: {
    apiKey: string;
    apiSecret: string;
  };
  changenow?: {
    apiKey: string;
  };
}

export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor(config: AdapterRegistryConfig) {
    // Initialize EVM DEX adapters
    if (config.oneInch?.apiKey) {
      this.adapters.set('1inch', new OneInchAdapter({
        apiKey: config.oneInch.apiKey,
        baseUrl: 'https://api.1inch.dev',
      }));
    }

    if (config.lifi) {
      this.adapters.set('lifi', new LiFiAdapter({
        apiKey: config.lifi.apiKey,
        baseUrl: 'https://li.quest/v1',
      }));
    }

    // Initialize bridge adapters
    if (config.socket) {
      this.adapters.set('socket', new SocketAdapter({
        apiKey: config.socket.apiKey,
      }));
    }

    if (config.rango) {
      this.adapters.set('rango', new RangoAdapter({
        apiKey: config.rango.apiKey,
      }));
    }

    // Initialize Solana adapter
    this.adapters.set('jupiter', new JupiterAdapter());

    // Initialize Sui adapter
    this.adapters.set('cetus', new CetusAdapter());

    // Initialize CEX adapters
    if (config.mexc?.apiKey && config.mexc?.secretKey) {
      this.adapters.set('mexc', new MEXCAdapter({
        apiKey: config.mexc.apiKey,
        secretKey: config.mexc.secretKey,
        baseUrl: 'https://api.mexc.com',
      }));
    }

    if (config.changelly?.apiKey && config.changelly?.apiSecret) {
      this.adapters.set('changelly', new ChangellyAdapter({
        apiKey: config.changelly.apiKey,
        apiSecret: config.changelly.apiSecret,
      }));
    }

    if (config.changenow?.apiKey) {
      this.adapters.set('changenow', new ChangeNowAdapter({
        apiKey: config.changenow.apiKey,
      }));
    }
  }

  /**
   * Get all adapters that can handle the given swap
   */
  getAdaptersForSwap(params: AdapterQuoteParams): BaseAdapter[] {
    const result: BaseAdapter[] = [];

    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(params)) {
        result.push(adapter);
      }
    }

    return result;
  }

  /**
   * Get adapters by type
   */
  getAdaptersByType(type: 'DEX' | 'BRIDGE' | 'CEX'): BaseAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.type === type);
  }

  /**
   * Get adapter by name
   */
  getAdapter(name: string): BaseAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Fetch quotes from all applicable adapters with fallback logic
   */
  async fetchAllQuotes(
    params: AdapterQuoteParams,
    options?: {
      preferredAdapters?: string[];
      excludeAdapters?: string[];
      includeCex?: boolean;
      timeout?: number;
    }
  ): Promise<{ adapter: string; quote: AdapterQuoteResult; type: string }[]> {
    let adapters = this.getAdaptersForSwap(params);

    // Filter by preferences
    if (options?.excludeAdapters?.length) {
      adapters = adapters.filter(a => !options.excludeAdapters!.includes(a.name));
    }

    if (!options?.includeCex) {
      adapters = adapters.filter(a => a.type !== 'CEX');
    }

    // Sort preferred adapters first
    if (options?.preferredAdapters?.length) {
      adapters.sort((a, b) => {
        const aPreferred = options.preferredAdapters!.includes(a.name) ? 0 : 1;
        const bPreferred = options.preferredAdapters!.includes(b.name) ? 0 : 1;
        return aPreferred - bPreferred;
      });
    }

    const timeout = options?.timeout || 30000;

    const quotePromises = adapters.map(async (adapter) => {
      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        );

        const quote = await Promise.race([
          adapter.getQuote(params),
          timeoutPromise,
        ]);

        if (quote) {
          return { adapter: adapter.name, quote, type: adapter.type };
        }
        return null;
      } catch (error) {
        console.error(`[${adapter.name}] Failed to fetch quote:`, error);
        return null;
      }
    });

    const results = await Promise.all(quotePromises);
    return results.filter((r): r is { adapter: string; quote: AdapterQuoteResult; type: string } => r !== null);
  }

  /**
   * Get best quote across all adapters
   */
  async getBestQuote(
    params: AdapterQuoteParams,
    options?: {
      preferredAdapters?: string[];
      excludeAdapters?: string[];
      includeCex?: boolean;
      sortBy?: 'output' | 'gas' | 'time';
    }
  ): Promise<{ adapter: string; quote: AdapterQuoteResult; type: string } | null> {
    const quotes = await this.fetchAllQuotes(params, options);

    if (!quotes.length) {
      return null;
    }

    const sortBy = options?.sortBy || 'output';

    quotes.sort((a, b) => {
      switch (sortBy) {
        case 'output':
          return BigInt(b.quote.outputAmount) > BigInt(a.quote.outputAmount) ? 1 : -1;
        case 'gas':
          return parseFloat(a.quote.estimatedGas) - parseFloat(b.quote.estimatedGas);
        case 'time':
          return (a.quote.route?.estimatedTimeSeconds || 0) - (b.quote.route?.estimatedTimeSeconds || 0);
        default:
          return 0;
      }
    });

    return quotes[0];
  }
}

// Export all adapters
export { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult } from './base.adapter';
export { OneInchAdapter } from './evm/oneinch.adapter';
export { LiFiAdapter } from './evm/lifi.adapter';
export { JupiterAdapter } from './solana/jupiter.adapter';
export { CetusAdapter } from './sui/cetus.adapter';
export { MEXCAdapter } from './cex/mexc.adapter';
export { SocketAdapter } from './bridge/socket.adapter';
export { RangoAdapter } from './bridge/rango.adapter';
export { ChangellyAdapter } from './cex/changelly.adapter';
export { ChangeNowAdapter } from './cex/changenow.adapter';
