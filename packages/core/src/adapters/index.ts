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

export type AdapterType = 'DEX' | 'BRIDGE' | 'CEX';

export interface QuoteResult {
  adapter: string;
  quote: AdapterQuoteResult;
  type: AdapterType;
}

export interface AdapterRegistryConfig {
  oneInch?: { apiKey: string };
  lifi?: { apiKey?: string };
  jupiter?: Record<string, never>;
  cetus?: Record<string, never>;
  mexc?: { apiKey: string; secretKey: string };
  socket?: { apiKey?: string };
  rango?: { apiKey?: string };
  changelly?: { apiKey: string; apiSecret: string };
  changenow?: { apiKey: string };
}

export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor(config: AdapterRegistryConfig) {
    if (config.oneInch?.apiKey) {
      this.adapters.set('1inch', new OneInchAdapter({
        apiKey: config.oneInch.apiKey,
        baseUrl: 'https://api.1inch.dev',
      }));
    }

    if (config.lifi !== undefined) {
      this.adapters.set('lifi', new LiFiAdapter({
        apiKey: config.lifi?.apiKey,
        baseUrl: 'https://li.quest/v1',
      }));
    }

    if (config.socket !== undefined) {
      this.adapters.set('socket', new SocketAdapter({
        apiKey: config.socket?.apiKey,
        baseUrl: 'https://api.socket.tech/v2',
      }));
    }

    if (config.rango !== undefined) {
      this.adapters.set('rango', new RangoAdapter({
        apiKey: config.rango?.apiKey,
        baseUrl: 'https://api.rango.exchange',
      }));
    }

    this.adapters.set('jupiter', new JupiterAdapter());
    this.adapters.set('cetus', new CetusAdapter());

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
        baseUrl: 'https://api.changelly.com',
      }));
    }

    if (config.changenow?.apiKey) {
      this.adapters.set('changenow', new ChangeNowAdapter({
        apiKey: config.changenow.apiKey,
        baseUrl: 'https://api.changenow.io/v2',
      }));
    }
  }

  getAdaptersForSwap(params: AdapterQuoteParams): BaseAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.canHandle(params));
  }

  getAdaptersByType(type: AdapterType): BaseAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.type === type);
  }

  getAdapter(name: string): BaseAdapter | undefined {
    return this.adapters.get(name);
  }

  getAllAdapters(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  async fetchAllQuotes(
    params: AdapterQuoteParams,
    options?: { excludeAdapters?: string[]; includeCex?: boolean; timeout?: number }
  ): Promise<QuoteResult[]> {
    let adapters = this.getAdaptersForSwap(params);

    if (options?.excludeAdapters?.length) {
      adapters = adapters.filter(a => !options.excludeAdapters!.includes(a.name));
    }
    if (!options?.includeCex) {
      adapters = adapters.filter(a => a.type !== 'CEX');
    }

    const timeout = options?.timeout || 30000;

    const results = await Promise.all(
      adapters.map(async (adapter): Promise<QuoteResult | null> => {
        try {
          const quote = await Promise.race([
            adapter.getQuote(params),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
          ]);
          return quote ? { adapter: adapter.name, quote, type: adapter.type } : null;
        } catch {
          return null;
        }
      })
    );

    return results.filter((r): r is QuoteResult => r !== null);
  }

  async getBestQuote(
    params: AdapterQuoteParams,
    options?: { excludeAdapters?: string[]; includeCex?: boolean; sortBy?: 'output' | 'time' }
  ): Promise<QuoteResult | null> {
    const quotes = await this.fetchAllQuotes(params, options);
    if (!quotes.length) return null;

    quotes.sort((a, b) => {
      if (options?.sortBy === 'time') {
        return a.quote.estimatedTime - b.quote.estimatedTime;
      }
      return BigInt(b.quote.outputAmount) > BigInt(a.quote.outputAmount) ? 1 : -1;
    });

    return quotes[0];
  }
}

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
