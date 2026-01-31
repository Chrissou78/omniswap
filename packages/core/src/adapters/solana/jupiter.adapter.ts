import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  maxAccounts?: number;
  platformFeeBps?: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: any;
  priceImpactPct: number;
  routePlan: JupiterRoutePlan[];
  contextSlot: number;
  timeTaken: number;
  inputDecimals?: number;
  outputDecimals?: number;
}

export interface JupiterRoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
    inputSymbol?: string;
    outputSymbol?: string;
  };
  percent: number;
}

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
  dynamicComputeUnitLimit?: boolean;
  skipUserAccountsRpcCalls?: boolean;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport: any;
  simulationError: any;
}

export class JupiterAdapter {
  private client: AxiosInstance;

  constructor(apiKey?: string) {
    this.client = axios.create({
      baseURL: 'https://quote-api.jup.ag/v6',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      timeout: 30000,
    });
  }

  async getQuote(request: JupiterQuoteRequest): Promise<JupiterQuoteResponse | null> {
    try {
      const params = new URLSearchParams({
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        amount: request.amount,
        slippageBps: request.slippageBps.toString(),
      });

      if (request.onlyDirectRoutes) {
        params.append('onlyDirectRoutes', 'true');
      }
      if (request.maxAccounts) {
        params.append('maxAccounts', request.maxAccounts.toString());
      }
      if (request.platformFeeBps) {
        params.append('platformFeeBps', request.platformFeeBps.toString());
      }

      const response = await this.client.get(`/quote?${params.toString()}`);

      // Get decimals for proper amount formatting
      const [inputInfo, outputInfo] = await Promise.all([
        this.getTokenInfo(request.inputMint),
        this.getTokenInfo(request.outputMint),
      ]);

      return {
        ...response.data,
        inputDecimals: inputInfo?.decimals || 9,
        outputDecimals: outputInfo?.decimals || 9,
      };
    } catch (error: any) {
      logger.error('Jupiter quote error', {
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async getSwapTransaction(request: JupiterSwapRequest): Promise<JupiterSwapResponse | null> {
    try {
      const response = await this.client.post('/swap', {
        quoteResponse: request.quoteResponse,
        userPublicKey: request.userPublicKey,
        wrapAndUnwrapSol: request.wrapAndUnwrapSol ?? true,
        useSharedAccounts: request.useSharedAccounts ?? true,
        dynamicComputeUnitLimit: request.dynamicComputeUnitLimit ?? true,
        prioritizationFeeLamports: request.prioritizationFeeLamports,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Jupiter swap error', {
        error: error.response?.data || error.message,
      });
      return null;
    }
  }

  async getTokenInfo(mint: string): Promise<{ symbol: string; name: string; decimals: number } | null> {
    try {
      const response = await axios.get(`https://tokens.jup.ag/token/${mint}`);
      return {
        symbol: response.data.symbol,
        name: response.data.name,
        decimals: response.data.decimals,
      };
    } catch {
      return null;
    }
  }

  async getTokenList(): Promise<any[]> {
    try {
      const response = await axios.get('https://tokens.jup.ag/tokens?tags=verified');
      return response.data;
    } catch (error) {
      logger.error('Jupiter token list error', { error });
      return [];
    }
  }

  async getPriorityFee(): Promise<number> {
    try {
      const response = await this.client.get('/priority-fee');
      return response.data.priorityFeeLamports || 50000;
    } catch {
      return 50000; // Default priority fee
    }
  }
}
