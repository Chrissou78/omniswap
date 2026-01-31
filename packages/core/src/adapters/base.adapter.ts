// packages/core/src/adapters/base.adapter.ts

import {
  Token,
  Route,
  RouteStep,
  QuoteRequest,
  Chain,
  ChainType,
} from '@omniswap/types';

export interface AdapterQuoteParams {
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  slippage: number;
  userAddress?: string;
}

export interface AdapterQuoteResult {
  outputAmount: string;
  minimumOutput: string;
  route: RouteStep[];
  estimatedGas?: string;
  estimatedGasUsd?: number;
  estimatedTime: number;
  priceImpact: number;
  
  // For execution
  txData?: string;
  txTo?: string;
  txValue?: string;
}

export interface AdapterConfig {
  apiKey?: string;
  baseUrl: string;
  timeout?: number;
}

export abstract class BaseAdapter {
  abstract readonly name: string;
  abstract readonly type: 'DEX' | 'BRIDGE' | 'CEX';
  abstract readonly supportedChains: string[];
  
  protected config: AdapterConfig;
  
  constructor(config: AdapterConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    };
  }

  /**
   * Check if this adapter supports the given chain
   */
  supportsChain(chainId: string): boolean {
    return this.supportedChains.includes(chainId);
  }

  /**
   * Check if this adapter can handle the given swap
   */
  abstract canHandle(params: AdapterQuoteParams): boolean;

  /**
   * Get a quote for the given swap
   */
  abstract getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null>;

  /**
   * Build transaction data for execution
   */
  abstract buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
  }>;

  /**
   * Fetch with timeout and error handling
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`${this.name} adapter timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Safe JSON fetch
   */
  protected async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await this.fetchWithTimeout(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
    }
    
    return response.json();
  }
}
