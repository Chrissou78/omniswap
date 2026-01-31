// apps/web/src/services/mexcService.ts
'use client';

export interface MexcRoute {
  steps: Array<{
    action: 'deposit' | 'trade' | 'withdraw';
    from?: string;
    to?: string;
    fee?: number;
    feeUsd?: number;
  }>;
  path: string[];
  totalFeeUsd: number;
  platformFeeUsd: number; // Add this
  estimatedTime: string;
  description: string;
  expectedOutput: number;
}

export interface MexcComparison {
  useMexc: boolean;
  savings: number;
  route: MexcRoute | null;
  reason: string;
}

const MEXC_SUPPORTED = new Set([
  'ETH', 'BTC', 'USDT', 'USDC', 'BNB', 'SOL', 'MATIC', 'POL',
  'AVAX', 'ARB', 'OP', 'LINK', 'UNI', 'AAVE', 'CRV', 'MKR',
  'FTM', 'DOGE', 'SHIB', 'PEPE', 'SUI', 'APT', 'SEI', 'WETH',
  'WBTC', 'WBNB', 'WMATIC', 'WAVAX', 'WFTM',
]);

const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD']);

// Platform fee for CEX route
const PLATFORM_FEE_CEX = parseFloat(process.env.NEXT_PUBLIC_PLATFORM_FEE_CEX || '0.01');

// Withdrawal fees in TOKEN UNITS
const WITHDRAW_FEES_TOKEN: Record<string, number> = {
  'ETH': 0.0005,
  'WETH': 0.0005,
  'BTC': 0.0001,
  'WBTC': 0.0001,
  'USDT': 1,
  'USDC': 1,
  'BNB': 0.001,
  'WBNB': 0.001,
  'SOL': 0.01,
  'MATIC': 0.1,
  'POL': 0.1,
  'WMATIC': 0.1,
  'AVAX': 0.01,
  'WAVAX': 0.01,
  'ARB': 0.1,
  'OP': 0.1,
  'FTM': 1,
  'WFTM': 1,
  'SUI': 0.1,
  'APT': 0.01,
  'SEI': 0.5,
  'LINK': 0.05,
  'UNI': 0.1,
  'AAVE': 0.01,
  'DOGE': 5,
  'SHIB': 100000,
  'PEPE': 1000000,
};

// Cache for prices
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 30 * 1000;

async function getMexcPrice(symbol: string): Promise<number | null> {
  const upperSymbol = symbol.toUpperCase();

  if (STABLECOINS.has(upperSymbol)) {
    return 1;
  }

  const cached = priceCache.get(upperSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  try {
    const response = await fetch(`/api/mexc/price?symbol=${upperSymbol}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const price = data.price;

    if (typeof price === 'number' && price > 0) {
      priceCache.set(upperSymbol, { price, timestamp: Date.now() });
      return price;
    }

    return null;
  } catch (error) {
    console.error(`[MEXC] Error fetching price for ${upperSymbol}:`, error);
    return null;
  }
}

export async function compareMexcRoute(
  fromSymbol: string,
  toSymbol: string,
  amount: number,
  fromChainId: string | number,
  toChainId: string | number,
  directCostUsd: number
): Promise<MexcComparison> {
  const fromUpper = fromSymbol.toUpperCase();
  const toUpper = toSymbol.toUpperCase();

  if (!MEXC_SUPPORTED.has(fromUpper)) {
    return {
      useMexc: false,
      savings: 0,
      route: null,
      reason: `${fromUpper} not supported on CEX`,
    };
  }

  if (!MEXC_SUPPORTED.has(toUpper)) {
    return {
      useMexc: false,
      savings: 0,
      route: null,
      reason: `${toUpper} not supported on CEX`,
    };
  }

  try {
    const [fromPrice, toPrice] = await Promise.all([
      getMexcPrice(fromUpper),
      getMexcPrice(toUpper),
    ]);

    if (!fromPrice || !toPrice) {
      return {
        useMexc: false,
        savings: 0,
        route: null,
        reason: `Unable to fetch CEX prices`,
      };
    }

    const valueUsd = amount * fromPrice;

    // Fee calculations
    const depositFee = 0;
    const tradingFeeRate = 0.001; // 0.1% per trade

    const withdrawFeeTokenAmount = WITHDRAW_FEES_TOKEN[toUpper] || 0.001;
    const withdrawFeeUsd = withdrawFeeTokenAmount * toPrice;

    const needsIntermediate = !STABLECOINS.has(fromUpper) && !STABLECOINS.has(toUpper);
    const tradingFeeUsd = needsIntermediate
      ? valueUsd * tradingFeeRate * 2
      : valueUsd * tradingFeeRate;

    // Platform fee (1%)
    const platformFeeUsd = valueUsd * PLATFORM_FEE_CEX;

    // Total cost including platform fee
    const totalMexcCostUsd = depositFee + tradingFeeUsd + withdrawFeeUsd + platformFeeUsd;

    // Expected output
    const netValueUsd = valueUsd - tradingFeeUsd - platformFeeUsd;
    const expectedOutputBeforeWithdraw = netValueUsd / toPrice;
    const expectedOutput = expectedOutputBeforeWithdraw - withdrawFeeTokenAmount;

    const savings = directCostUsd - totalMexcCostUsd;
    const useMexc = savings > 3 && directCostUsd > 10;

    console.log(`[MEXC] ${fromUpper}->${toUpper}: value=$${valueUsd.toFixed(2)}, cexFee=$${(tradingFeeUsd + withdrawFeeUsd).toFixed(2)}, platformFee=$${platformFeeUsd.toFixed(2)}, total=$${totalMexcCostUsd.toFixed(2)}, savings=$${savings.toFixed(2)}`);

    const steps: MexcRoute['steps'] = [
      { action: 'deposit', from: fromUpper, feeUsd: 0 },
    ];

    const path: string[] = [fromUpper];

    if (needsIntermediate) {
      steps.push({ action: 'trade', from: fromUpper, to: 'USDT', feeUsd: tradingFeeUsd / 2 });
      steps.push({ action: 'trade', from: 'USDT', to: toUpper, feeUsd: tradingFeeUsd / 2 });
      path.push('USDT', toUpper);
    } else {
      steps.push({ action: 'trade', from: fromUpper, to: toUpper, feeUsd: tradingFeeUsd });
      path.push(toUpper);
    }

    steps.push({ action: 'withdraw', to: toUpper, fee: withdrawFeeTokenAmount, feeUsd: withdrawFeeUsd });

    const route: MexcRoute = {
      steps,
      path,
      totalFeeUsd: Math.round(totalMexcCostUsd * 100) / 100,
      platformFeeUsd: Math.round(platformFeeUsd * 100) / 100,
      estimatedTime: '5-15 min',
      description: path.join(' → '),
      expectedOutput: Math.max(0, expectedOutput),
    };

    return {
      useMexc,
      savings: Math.round(Math.max(0, savings) * 100) / 100,
      route,
      reason: useMexc
        ? `Save ~$${savings.toFixed(2)} via CEX`
        : savings > 0
          ? `Savings $${savings.toFixed(2)} below threshold`
          : 'Direct swap is cheaper',
    };
  } catch (error) {
    console.error('[MEXC] Error comparing route:', error);
    return {
      useMexc: false,
      savings: 0,
      route: null,
      reason: 'Error calculating CEX route',
    };
  }
}

export { getMexcPrice };
