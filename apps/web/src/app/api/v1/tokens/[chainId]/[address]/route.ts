// apps/web/src/app/api/v1/tokens/[chainId]/[address]/route.ts
//
// Real current price for a token, used by the alerts UI to show live prices and
// distance-to-target. Public (prices aren't user data) but read-only.

import { NextRequest, NextResponse } from 'next/server';
import { getServerTokenPrice } from '@/lib/serverPrice';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> }
) {
  const { chainId, address } = await params;

  try {
    const price = await getServerTokenPrice(chainId, address);

    if (!price || price.priceUsd == null) {
      return NextResponse.json({ error: 'Price unavailable for this token' }, { status: 404 });
    }

    return NextResponse.json({
      price: price.priceUsd,
      priceChange24h: price.change24h ?? 0,
    });
  } catch (error) {
    console.error('Token price fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch token price' }, { status: 500 });
  }
}
