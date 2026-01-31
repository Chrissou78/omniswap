import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface LiFiRouteRequest {
  fromChainId: number;
  fromTokenAddress: string;
  toChainId: number;
  toTokenAddress: string;
  fromAmount: string;
  slippage: number;
  fromAddress?: string;
  toAddress?: string;
  order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST' | 'SAFEST';
  allowBridges?: string[];
  denyBridges?: string[];
  allowExchanges?: string[];
  denyExchanges?: string[];
}

export interface LiFiRoute {
  id: string;
  fromChainId: number;
  fromToken: LiFiToken;
  fromAmount: string;
  fromAmountUSD: string;
  toChainId: number;
  toToken: LiFiToken;
  toAmount: string;
  toAmountMin: string;
  toAmountUSD: string;
  gasCostUSD: string;
  steps: LiFiStep[];
  tags: string[];
  insurance?: {
    state: string;
    feeAmountUSD: string;
  };
}

export interface LiFiToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI: string;
  priceUSD: string;
}

export interface LiFiStep {
  id: string;
  type: 'swap' | 'cross' | 'lifi';
  tool: string;
  toolDetails: {
    key: string;
    name: string;
    logoURI: string;
  };
  action: {
    fromChainId: number;
    fromToken: LiFiToken;
    fromAmount: string;
    toChainId: number;
    toToken: LiFiToken;
    slippage: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    executionDuration: number;
    feeCosts: any[];
    gasCosts: any[];
  };
  transactionRequest?: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
    chainId: number;
  };
}

export interface LiFiQuoteRequest {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippage?: number;
  order?: string;
  integrator?: string;
}

export class LiFiAdapter {
  private client: AxiosInstance;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://li.quest/v1',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-lifi-api-key': apiKey } : {}),
      },
      timeout: 60000, // Cross-chain can be slow
    });
  }

  async getRoutes(request: LiFiRouteRequest): Promise<LiFiRoute[]> {
    try {
      const response = await this.client.post('/advanced/routes', {
        fromChainId: request.fromChainId,
        fromTokenAddress: request.fromTokenAddress,
        toChainId: request.toChainId,
        toTokenAddress: request.toTokenAddress,
        fromAmount: request.fromAmount,
        options: {
          slippage: request.slippage,
          order: request.order || 'RECOMMENDED',
          allowBridges: request.allowBridges,
          denyBridges: request.denyBridges,
          allowExchanges: request.allowExchanges,
          denyExchanges: request.denyExchanges,
          integrator: 'omniswap',
        },
        ...(request.fromAddress && { fromAddress: request.fromAddress }),
        ...(request.toAddress && { toAddress: request.toAddress }),
      });

      return response.data.routes || [];
    } catch (error: any) {
      logger.error('Li.Fi routes error', {
        fromChainId: request.fromChainId,
        toChainId: request.toChainId,
        error: error.response?.data || error.message,
      });
      return [];
    }
  }

  async getQuote(request: LiFiQuoteRequest): Promise<LiFiRoute | null> {
    try {
      const response = await this.client.get('/quote', {
        params: {
          fromChain: request.fromChain,
          toChain: request.toChain,
          fromToken: request.fromToken,
          toToken: request.toToken,
          fromAmount: request.fromAmount,
          fromAddress: request.fromAddress,
          toAddress: request.toAddress || request.fromAddress,
          slippage: request.slippage || 0.03,
          integrator: request.integrator || 'omniswap',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('Li.Fi quote error', {
        fromChain: request.fromChain,
        toChain: request.toChain,
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async getStepTransaction(step: LiFiStep): Promise<LiFiStep | null> {
    try {
      const response = await this.client.post('/advanced/stepTransaction', {
        step,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Li.Fi step transaction error', {
        stepId: step.id,
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async getStatus(
    bridge: string,
    fromChain: number,
    toChain: number,
    txHash: string
  ): Promise<{
    status: 'NOT_FOUND' | 'PENDING' | 'DONE' | 'FAILED';
    substatus?: string;
    receiving?: {
      txHash: string;
      amount: string;
    };
  } | null> {
    try {
      const response = await this.client.get('/status', {
        params: {
          bridge,
          fromChain,
          toChain,
          txHash,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('Li.Fi status error', { txHash, error: error.message });
      return null;
    }
  }

  async getChains(): Promise<any[]> {
    try {
      const response = await this.client.get('/chains');
      return response.data.chains || [];
    } catch (error) {
      logger.error('Li.Fi chains error', { error });
      return [];
    }
  }

  async getTokens(chainId?: number): Promise<any> {
    try {
      const params = chainId ? { chains: chainId.toString() } : {};
      const response = await this.client.get('/tokens', { params });
      return response.data.tokens || {};
    } catch (error) {
      logger.error('Li.Fi tokens error', { error });
      return {};
    }
  }

  async getConnections(
    fromChain: number,
    toChain: number,
    fromToken?: string,
    toToken?: string
  ): Promise<any> {
    try {
      const response = await this.client.get('/connections', {
        params: {
          fromChain,
          toChain,
          fromToken,
          toToken,
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Li.Fi connections error', { error });
      return null;
    }
  }
}
