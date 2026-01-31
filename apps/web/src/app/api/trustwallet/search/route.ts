// apps/web/src/app/api/trustwallet/search/route.ts

import { NextRequest, NextResponse } from 'next/server';

const TRUSTWALLET_BASE = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

/**
 * Verify if a TrustWallet chain exists by fetching its info.json
 */
async function fetchTrustWalletInfo(trustwalletId: string) {
  try {
    const infoUrl = `${TRUSTWALLET_BASE}/${trustwalletId}/info/info.json`;
    const response = await fetch(infoUrl, { 
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Generate possible TrustWallet IDs from a name/symbol
 */
function generatePossibleIds(input: string): string[] {
  const normalized = input.toLowerCase().trim();
  
  const variations = [
    normalized,
    normalized.replace(/\s+/g, ''),
    normalized.replace(/\s+/g, '-'),
    normalized.split(' ')[0],
  ];
  
  // Remove duplicates
  return [...new Set(variations)];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const symbol = searchParams.get('symbol');
    
    if (!name && !symbol) {
      return NextResponse.json(
        { error: 'Name or symbol is required' },
        { status: 400 }
      );
    }
    
    // Generate possible IDs to try
    const possibleIds: string[] = [];
    if (name) possibleIds.push(...generatePossibleIds(name));
    if (symbol) possibleIds.push(symbol.toLowerCase());
    
    // Try each ID against TrustWallet's live repository
    for (const id of possibleIds) {
      const chainInfo = await fetchTrustWalletInfo(id);
      
      if (chainInfo) {
        return NextResponse.json({
          trustwalletId: id,
          logoUrl: `${TRUSTWALLET_BASE}/${id}/info/logo.png`,
          chainInfo,
          found: true,
        });
      }
    }
    
    // Not found
    return NextResponse.json({
      trustwalletId: null,
      logoUrl: null,
      chainInfo: null,
      found: false,
    });
    
  } catch (error) {
    console.error('TrustWallet search error:', error);
    return NextResponse.json(
      { error: 'Failed to search TrustWallet' },
      { status: 500 }
    );
  }
}
