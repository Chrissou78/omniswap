// apps/web/src/app/api/mexc/price/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Cache for prices (server-side)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  // Check cache
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      symbol,
      price: cached.price,
      cached: true,
    });
  }

  try {
    // Try USDT pair first
    let price = await fetchMexcPrice(`${symbol}USDT`);

    // If no USDT pair, try USDC
    if (!price) {
      price = await fetchMexcPrice(`${symbol}USDC`);
    }

    if (price) {
      priceCache.set(symbol, { price, timestamp: Date.now() });
      return NextResponse.json({
        symbol,
        price,
        cached: false,
      });
    }

    return NextResponse.json(
      { error: `Price not found for ${symbol}` },
      { status: 404 }
    );
  } catch (error) {
    console.error(`[MEXC API] Error fetching price for ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch price from MEXC' },
      { status: 500 }
    );
  }
}

async function fetchMexcPrice(pair: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.mexc.com/api/v3/ticker/price?symbol=${pair}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.price) {
      return parseFloat(data.price);
    }

    return null;
  } catch (error) {
    console.error(`[MEXC API] Error fetching ${pair}:`, error);
    return null;
  }
}
