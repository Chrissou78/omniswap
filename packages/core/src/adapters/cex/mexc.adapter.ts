// packages/core/src/adapters/cex/mexc.adapter.ts

import crypto from 'crypto';
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';
import { Token, RouteStep } from '@omniswap/types';

interface MEXCTickerResponse {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  prevClosePrice: string;
  lastPrice: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

interface MEXCOrderBookResponse {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

interface MEXCDepositAddressResponse {
  coin: string;
  address: string;
  tag?: string;
  network: string;
}

interface MEXCWithdrawInfo {
  coin: string;
  network: string;
  withdrawEnable: boolean;
  withdrawFee: string;
  withdrawMin: string;
  withdrawMax: string;
}

// Mapping from chain to MEXC network name
const CHAIN_TO_NETWORK: Record<string, string> = {
  ethereum: 'ERC20',
  arbitrum: 'ARBITRUM',
  optimism: 'OPTIMISM',
  polygon: 'MATIC',
  bsc: 'BEP20',
  avalanche: 'AVAX_CCHAIN',
  base: 'BASE',
  solana: 'SOL',
  sui: 'SUI',
};

export class MEXCAdapter extends BaseAdapter {
  readonly name = 'MEXC';
  readonly type = 'CEX' as const;
  readonly supportedChains = Object.keys(CHAIN_TO_NETWORK);

  private apiKey: string;
  private secretKey: string;

  constructor(config: AdapterConfig & { apiKey: string; secretKey: string }) {
    super({
      baseUrl: 'https://api.mexc.com',
      ...config,
    });
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
  }

  canHandle(params: AdapterQuoteParams): boolean {
    // MEXC can handle cross-chain swaps via deposit/trade/withdraw
    return (
      this.supportsChain(params.inputToken.chainId) &&
      this.supportsChain(params.outputToken.chainId)
    );
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    try {
      // For CEX routing, we need to:
      // 1. Check if input token can be deposited
      // 2. Find trading pair to output token
      // 3. Check if output token can be withdrawn to target chain

      const inputSymbol = params.inputToken.symbol.toUpperCase();
      const outputSymbol = params.outputToken.symbol.toUpperCase();

      // Find best trading route (might need intermediate token like USDT)
      const tradingRoute = await this.findTradingRoute(inputSymbol, outputSymbol);
      
      if (!tradingRoute) {
        console.warn(`[MEXC] No trading route found for ${inputSymbol} -> ${outputSymbol}`);
        return null;
      }

      // Get current price
      const outputAmount = await this.calculateOutputAmount(
        tradingRoute,
        params.inputAmount,
        params.inputToken.decimals,
        params.outputToken.decimals
      );

      if (!outputAmount) {
        return null;
      }

      // Get withdrawal fee for output token
      const withdrawInfo = await this.getWithdrawInfo(
        outputSymbol,
        CHAIN_TO_NETWORK[params.outputToken.chainId]
      );

      // Calculate minimum output (accounting for trading slippage and withdraw fee)
      const withdrawFee = parseFloat(withdrawInfo?.withdrawFee || '0');
      const slippageMultiplier = 1 - (params.slippage / 100);
      const outputAfterFee = parseFloat(outputAmount) - withdrawFee;
      const minimumOutput = (outputAfterFee * slippageMultiplier).toString();

      // Build route steps
      const routeSteps = this.buildRouteSteps(
        tradingRoute,
        params.inputToken,
        params.outputToken,
        params.inputAmount,
        outputAmount,
        withdrawFee.toString()
      );

      // Estimate time: deposit confirmation + trading + withdrawal
      // This can be 5-30 minutes depending on chains
      const estimatedTime = this.estimateTime(
        params.inputToken.chainId,
        params.outputToken.chainId
      );

      return {
        outputAmount,
        minimumOutput,
        route: routeSteps,
        estimatedTime,
        priceImpact: 0.1, // Assume minimal for liquid pairs
      };
    } catch (error) {
      console.error(`[MEXC] Quote error:`, error);
      return null;
    }
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string }> {
    // For CEX, we return the deposit address
    // The actual execution requires multiple steps handled separately
    const network = CHAIN_TO_NETWORK[params.inputToken.chainId];
    const depositAddress = await this.getDepositAddress(
      params.inputToken.symbol,
      network
    );

    return {
      to: depositAddress.address,
      data: '0x', // Simple transfer
      value: params.inputAmount,
    };
  }

  /**
   * Get deposit address for a coin/network
   */
  async getDepositAddress(
    coin: string,
    network: string
  ): Promise<MEXCDepositAddressResponse> {
    const timestamp = Date.now();
    const queryString = `coin=${coin}&network=${network}&timestamp=${timestamp}`;
    const signature = this.sign(queryString);

    const response = await this.fetchJson<MEXCDepositAddressResponse>(
      `${this.config.baseUrl}/api/v3/capital/deposit/address?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MEXC-APIKEY': this.apiKey,
        },
      }
    );

    return response;
  }

  /**
   * Get withdrawal info for a coin/network
   */
  async getWithdrawInfo(
    coin: string,
    network: string
  ): Promise<MEXCWithdrawInfo | null> {
    try {
      const response = await this.fetchJson<{
        coin: string;
        networkList: MEXCWithdrawInfo[];
      }>(`${this.config.baseUrl}/api/v3/capital/config/getall`);

      const coinConfig = response;
      if (!coinConfig) return null;

      return coinConfig.networkList.find(n => n.network === network) || null;
    } catch {
      return null;
    }
  }

  /**
   * Place a market order
   */
  async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: string
  ): Promise<{ orderId: string; executedQty: string; price: string }> {
    const timestamp = Date.now();
    const params = {
      symbol,
      side,
      type: 'MARKET',
      quantity,
      timestamp: timestamp.toString(),
    };

    const queryString = new URLSearchParams(params).toString();
    const signature = this.sign(queryString);

    const response = await this.fetchJson<{
      orderId: string;
      executedQty: string;
      cummulativeQuoteQty: string;
    }>(
      `${this.config.baseUrl}/api/v3/order?${queryString}&signature=${signature}`,
      {
        method: 'POST',
        headers: {
          'X-MEXC-APIKEY': this.apiKey,
        },
      }
    );

    const avgPrice = (
      parseFloat(response.cummulativeQuoteQty) / parseFloat(response.executedQty)
    ).toString();

    return {
      orderId: response.orderId,
      executedQty: response.executedQty,
      price: avgPrice,
    };
  }

  /**
   * Withdraw funds
   */
  async withdraw(
    coin: string,
    network: string,
    address: string,
    amount: string
  ): Promise<{ id: string }> {
    const timestamp = Date.now();
    const params = {
      coin,
      network,
      address,
      amount,
      timestamp: timestamp.toString(),
    };

    const queryString = new URLSearchParams(params).toString();
    const signature = this.sign(queryString);

    const response = await this.fetchJson<{ id: string }>(
      `${this.config.baseUrl}/api/v3/capital/withdraw?${queryString}&signature=${signature}`,
      {
        method: 'POST',
        headers: {
          'X-MEXC-APIKEY': this.apiKey,
        },
      }
    );

    return response;
  }

  /**
   * Find best trading route between two symbols
   */
  private async findTradingRoute(
    inputSymbol: string,
    outputSymbol: string
  ): Promise<string[] | null> {
    // Direct pair
    const directPairs = [
      `${inputSymbol}${outputSymbol}`,
      `${outputSymbol}${inputSymbol}`,
    ];

    for (const pair of directPairs) {
      if (await this.pairExists(pair)) {
        return [pair];
      }
    }

    // Route through USDT
    const viaUSDT = [
      `${inputSymbol}USDT`,
      `${outputSymbol}USDT`,
    ];

    const [hasInputUSDT, hasOutputUSDT] = await Promise.all([
      this.pairExists(viaUSDT[0]),
      this.pairExists(viaUSDT[1]),
    ]);

    if (hasInputUSDT && hasOutputUSDT) {
      return viaUSDT;
    }

    // Route through USDC
    const viaUSDC = [
      `${inputSymbol}USDC`,
      `${outputSymbol}USDC`,
    ];

    const [hasInputUSDC, hasOutputUSDC] = await Promise.all([
      this.pairExists(viaUSDC[0]),
      this.pairExists(viaUSDC[1]),
    ]);

    if (hasInputUSDC && hasOutputUSDC) {
      return viaUSDC;
    }

    return null;
  }

  /**
   * Check if trading pair exists
   */
  private async pairExists(symbol: string): Promise<boolean> {
    try {
      const response = await this.fetchJson<MEXCTickerResponse>(
        `${this.config.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`
      );
      return !!response.lastPrice;
    } catch {
      return false;
    }
  }

  /**
   * Calculate output amount based on trading route
   */
  private async calculateOutputAmount(
    route: string[],
    inputAmount: string,
    inputDecimals: number,
    outputDecimals: number
  ): Promise<string | null> {
    try {
      let currentAmount = parseFloat(inputAmount) / Math.pow(10, inputDecimals);

      for (const pair of route) {
        const ticker = await this.fetchJson<MEXCTickerResponse>(
          `${this.config.baseUrl}/api/v3/ticker/24hr?symbol=${pair}`
        );

        const price = parseFloat(ticker.lastPrice);
        
        // Determine if we're buying or selling
        // This is simplified - in production you'd parse the pair properly
        currentAmount = currentAmount * price;
      }

      // Convert back to smallest units
      return Math.floor(currentAmount * Math.pow(10, outputDecimals)).toString();
    } catch {
      return null;
    }
  }

  /**
   * Sign request with HMAC SHA256
   */
  private sign(queryString: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Build route steps for CEX swap
   */
  private buildRouteSteps(
    tradingRoute: string[],
    inputToken: Token,
    outputToken: Token,
    inputAmount: string,
    outputAmount: string,
    withdrawFee: string
  ): RouteStep[] {
    const steps: RouteStep[] = [];

    // Step 1: Deposit to MEXC
    steps.push({
      type: 'CEX_DEPOSIT',
      chainId: inputToken.chainId,
      protocol: 'MEXC',
      protocolLogo: '/protocols/mexc.svg',
      inputToken,
      outputToken: { ...inputToken, chainId: 'mexc' },
      inputAmount,
      expectedOutput: inputAmount,
      minimumOutput: inputAmount,
      estimatedTime: this.getDepositTime(inputToken.chainId),
    });

    // Step 2: Trade(s)
    for (const pair of tradingRoute) {
      steps.push({
        type: 'CEX_TRADE',
        chainId: 'mexc',
        protocol: 'MEXC',
        protocolLogo: '/protocols/mexc.svg',
        inputToken: steps[steps.length - 1].outputToken,
        outputToken: { ...outputToken, chainId: 'mexc' },
        inputAmount: steps[steps.length - 1].expectedOutput,
        expectedOutput: outputAmount,
        minimumOutput: outputAmount,
        estimatedTime: 5, // Trading is instant
      });
    }

    // Step 3: Withdraw from MEXC
    const outputAfterFee = (
      parseFloat(outputAmount) - parseFloat(withdrawFee)
    ).toString();

    steps.push({
      type: 'CEX_WITHDRAW',
      chainId: 'mexc',
      protocol: 'MEXC',
      protocolLogo: '/protocols/mexc.svg',
      inputToken: { ...outputToken, chainId: 'mexc' },
      outputToken,
      inputAmount: outputAmount,
      expectedOutput: outputAfterFee,
      minimumOutput: outputAfterFee,
      estimatedTime: this.getWithdrawTime(outputToken.chainId),
    });

    return steps;
  }

  /**
   * Get estimated deposit confirmation time
   */
  private getDepositTime(chainId: string): number {
    const times: Record<string, number> = {
      ethereum: 300,   // 5 minutes (12 confirmations)
      arbitrum: 60,    // 1 minute
      optimism: 60,
      polygon: 120,    // 2 minutes
      bsc: 60,
      avalanche: 30,
      base: 60,
      solana: 30,
      sui: 15,
    };
    return times[chainId] || 300;
  }

  /**
   * Get estimated withdrawal time
   */
  private getWithdrawTime(chainId: string): number {
    // Withdrawals are usually processed within a few minutes
    // but network confirmation time varies
    return this.getDepositTime(chainId) + 60; // Add 1 minute for processing
  }

  /**
   * Estimate total time for CEX route
   */
  private estimateTime(fromChain: string, toChain: string): number {
    return (
      this.getDepositTime(fromChain) +
      10 + // Trading
      this.getWithdrawTime(toChain)
    );
  }
}
