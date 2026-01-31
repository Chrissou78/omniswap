// apps/web/src/app/api/delegated/config/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    address: process.env.RELAYER_ADDRESS || '',
    supportedChains: [1, 56, 137, 42161, 10, 8453, 43114],
    minSwapUsd: 10,
    maxSwapUsd: 50000,
    serviceFeePercent: 1,
    permitTokens: {
      // Tokens that support EIP-2612 permit
      1: [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0x6B175474E89094C44Da98b954EescdeCB5BE3830', // DAI
      ],
      137: [
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
      ],
    },
  });
}
