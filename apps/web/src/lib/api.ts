// apps/web/src/lib/api.ts
import { QuoteRequest, QuoteResponse, Swap, Token, ApiResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;
  private tenantId: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.tenantId = 'default';
  }

  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.tenantId,
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data.data as T;
  }


  // Generic GET method
  async get<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.fetch<T>(endpoint);
    return { data };
  }

  // Generic POST method  
  async post<T = any>(endpoint: string, body?: any): Promise<{ data: T }> {
    const data = await this.fetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  }

  // Generic DELETE method
  async delete<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.fetch<T>(endpoint, { method: 'DELETE' });
    return { data };
  }
  // ============ QUOTES ============

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    return this.fetch<QuoteResponse>('/api/v1/quote', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getQuoteById(quoteId: string): Promise<QuoteResponse> {
    return this.fetch<QuoteResponse>(`/api/v1/quote/${quoteId}`);
  }

  // ============ SWAPS ============

  async createSwap(params: {
    quoteId: string;
    routeId: string;
    userAddress: string;
  }): Promise<Swap> {
    return this.fetch<Swap>('/api/v1/swap', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getSwap(swapId: string): Promise<Swap> {
    return this.fetch<Swap>(`/api/v1/swap/${swapId}`);
  }

  async getSwapTransaction(swapId: string): Promise<{
    stepIndex: number;
    transaction: {
      to: string;
      data: string;
      value: string;
      chainId?: number;
      needsApproval?: boolean;
      approvalTx?: { to: string; data: string; value: string };
    };
  }> {
    return this.fetch(`/api/v1/swap/${swapId}/transaction`);
  }

  async executeSwapStep(swapId: string, signedTransaction: string): Promise<{
    txHash: string;
    swap: Swap;
  }> {
    return this.fetch(`/api/v1/swap/${swapId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ signedTransaction }),
    });
  }

  async getSwapHistory(address: string, limit = 20): Promise<Swap[]> {
    return this.fetch<Swap[]>(`/api/v1/swap/history?address=${address}&limit=${limit}`);
  }

  // ============ TOKENS ============

  async getTokens(chainId?: string): Promise<Token[]> {
    const params = chainId ? `?chainId=${chainId}` : '';
    return this.fetch<Token[]>(`/api/v1/tokens${params}`);
  }

  async searchTokens(query: string, chainId?: string): Promise<Token[]> {
    const params = new URLSearchParams({ q: query });
    if (chainId) params.set('chainId', chainId);
    return this.fetch<Token[]>(`/api/v1/tokens/search?${params}`);
  }

  async getPopularTokens(chainId?: string): Promise<Token[]> {
    const params = chainId ? `?chainId=${chainId}` : '';
    return this.fetch<Token[]>(`/api/v1/tokens/popular${params}`);
  }

  // ============ CONFIG ============

  async getTenantConfig(): Promise<any> {
    return this.fetch('/api/v1/config');
  }

  async getTenantTheme(): Promise<any> {
    return this.fetch('/api/v1/theme');
  }
}

export const api = new ApiClient(API_URL);

