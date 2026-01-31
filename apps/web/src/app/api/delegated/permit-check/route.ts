// apps/web/src/app/api/delegated/permit-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, base } from 'viem/chains';

const chains: Record<number, any> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
};

// Known tokens with permit support
const PERMIT_TOKENS: Record<number, string[]> = {
  1: [
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0x6B175474E89094C44Da98b954EeacdeCB5BE3830', // DAI
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
  ],
  137: [
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
  ],
  42161: [
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
  ],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = parseInt(searchParams.get('chainId') || '1');
  const token = searchParams.get('token')?.toLowerCase();

  if (!token) {
    return NextResponse.json({ error: 'Missing token address' }, { status: 400 });
  }

  // Check known permit tokens
  const permitTokens = PERMIT_TOKENS[chainId] || [];
  const isKnownPermit = permitTokens.some((t) => t.toLowerCase() === token);

  if (isKnownPermit) {
    return NextResponse.json({ supportsPermit: true, type: 'eip2612' });
  }

  // Try to check on-chain if token has permit function
  try {
    const chain = chains[chainId];
    if (!chain) {
      return NextResponse.json({ supportsPermit: false });
    }

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    // Try to read DOMAIN_SEPARATOR (indicates EIP-2612 support)
    try {
      await client.readContract({
        address: token as `0x${string}`,
        abi: [
          {
            name: 'DOMAIN_SEPARATOR',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'bytes32' }],
          },
        ],
        functionName: 'DOMAIN_SEPARATOR',
      });

      return NextResponse.json({ supportsPermit: true, type: 'eip2612' });
    } catch {
      // No DOMAIN_SEPARATOR, check for Permit2 support
      return NextResponse.json({ supportsPermit: false, type: null });
    }
  } catch (error) {
    return NextResponse.json({ supportsPermit: false });
  }
}
