// packages/core/src/adapters/cex/changelly.adapter.ts
import { BaseAdapter, AdapterQuoteParams, AdapterQuoteResult, AdapterConfig } from '../base.adapter';

export interface ChangellyConfig extends AdapterConfig {
  apiKey: string;
  apiSecret: string;
}

const DEFAULT_CONFIG: Partial<ChangellyConfig> = {
  baseUrl: 'https://api.changelly.com',
  timeout: 30000,
};

export class ChangellyAdapter extends BaseAdapter {
  readonly name = 'changelly';
  readonly type = 'CEX' as const;
  readonly supportedChains = ['1', '56', '137', '42161', '10', '8453', 'solana', 'bitcoin'];

  constructor(config: ChangellyConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    super(mergedConfig as AdapterConfig);
  }

  canHandle(params: AdapterQuoteParams): boolean {
    const fromChainId = params.fromChainId || params.inputToken.chainId;
    const toChainId = params.toChainId || params.outputToken.chainId;
    return this.supportsChain(fromChainId) && this.supportsChain(toChainId);
  }

  async getQuote(params: AdapterQuoteParams): Promise<AdapterQuoteResult | null> {
    // TODO: Implement Changelly API integration
    return null;
  }

  async buildTransaction(
    params: AdapterQuoteParams,
    quote: AdapterQuoteResult
  ): Promise<{ to: string; data: string; value: string; gasLimit?: string }> {
    throw new Error('Changelly uses deposit flow, not direct transactions');
  }
}
