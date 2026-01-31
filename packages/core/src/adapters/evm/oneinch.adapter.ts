import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface OneInchQuoteRequest {
  chainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  slippage: number;
  fromAddress?: string;
  protocols?: string;
  fee?: number;
  gasPrice?: string;
  complexityLevel?: number;
  parts?: number;
  mainRouteParts?: number;
}

export interface OneInchQuoteResponse {
  fromToken: {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    logoURI: string;
  };
  toToken: {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    logoURI: string;
  };
  toAmount: string;
  fromAmount: string;
  protocols: any[];
  estimatedGas: string;
  estimatedPriceImpact?: number;
}

export interface OneInchSwapRequest extends OneInchQuoteRequest {
  fromAddress: string;
  destReceiver?: string;
  referrerAddress?: string;
  disableEstimate?: boolean;
  permit?: string;
}

export interface OneInchSwapResponse extends OneInchQuoteResponse {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  };
}

export class OneInchAdapter {
  private client: AxiosInstance;
  private apiKey: string;

  private readonly SUPPORTED_CHAINS = [1, 56, 137, 42161, 10, 8453, 43114];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://api.1inch.dev',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  isChainSupported(chainId: number): boolean {
    return this.SUPPORTED_CHAINS.includes(chainId);
  }

  async getQuote(request: OneInchQuoteRequest): Promise<OneInchQuoteResponse | null> {
    if (!this.isChainSupported(request.chainId)) {
      logger.warn('Chain not supported by 1inch', { chainId: request.chainId });
      return null;
    }

    try {
      const params = new URLSearchParams({
        src: request.fromTokenAddress,
        dst: request.toTokenAddress,
        amount: request.amount,
        includeProtocols: 'true',
        includeGas: 'true',
      });

      if (request.fromAddress) {
        params.append('from', request.fromAddress);
      }
      if (request.protocols) {
        params.append('protocols', request.protocols);
      }
      if (request.fee) {
        params.append('fee', request.fee.toString());
      }

      const response = await this.client.get(
        `/swap/v6.0/${request.chainId}/quote?${params.toString()}`
      );

      return response.data;
    } catch (error: any) {
      logger.error('1inch quote error', {
        chainId: request.chainId,
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async getSwapData(request: OneInchSwapRequest): Promise<OneInchSwapResponse | null> {
    if (!this.isChainSupported(request.chainId)) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        src: request.fromTokenAddress,
        dst: request.toTokenAddress,
        amount: request.amount,
        from: request.fromAddress,
        slippage: request.slippage.toString(),
        includeProtocols: 'true',
        includeGas: 'true',
      });

      if (request.destReceiver) {
        params.append('receiver', request.destReceiver);
      }
      if (request.referrerAddress) {
        params.append('referrer', request.referrerAddress);
      }
      if (request.disableEstimate) {
        params.append('disableEstimate', 'true');
      }

      const response = await this.client.get(
        `/swap/v6.0/${request.chainId}/swap?${params.toString()}`
      );

      return response.data;
    } catch (error: any) {
      logger.error('1inch swap error', {
        chainId: request.chainId,
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async getApproveCalldata(
    chainId: number,
    tokenAddress: string,
    amount?: string
  ): Promise<{ to: string; data: string; value: string } | null> {
    try {
      const params = new URLSearchParams({
        tokenAddress,
      });

      if (amount) {
        params.append('amount', amount);
      }

      const response = await this.client.get(
        `/swap/v6.0/${chainId}/approve/transaction?${params.toString()}`
      );

      return response.data;
    } catch (error: any) {
      logger.error('1inch approve error', { chainId, error: error.message });
      return null;
    }
  }

  async getSpenderAddress(chainId: number): Promise<string | null> {
    try {
      const response = await this.client.get(
        `/swap/v6.0/${chainId}/approve/spender`
      );
      return response.data.address;
    } catch (error: any) {
      logger.error('1inch spender error', { chainId, error: error.message });
      return null;
    }
  }

  async getTokens(chainId: number): Promise<Record<string, any> | null> {
    try {
      const response = await this.client.get(
        `/swap/v6.0/${chainId}/tokens`
      );
      return response.data.tokens;
    } catch (error: any) {
      logger.error('1inch tokens error', { chainId, error: error.message });
      return null;
    }
  }
}
