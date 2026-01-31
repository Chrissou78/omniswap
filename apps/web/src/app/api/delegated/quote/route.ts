// apps/web/src/app/api/delegated/quote/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SERVICE_FEE_PERCENT = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      chainId,
      inputToken,
      outputToken,
      inputAmount,
      inputPriceUsd,
      outputPriceUsd,
    } = body;

    const inputAmountNum = parseFloat(inputAmount);
    const valueUsd = inputAmountNum * inputPriceUsd;

    // Validate
    if (valueUsd < 10 || valueUsd > 50000) {
      return NextResponse.json(
        { error: 'Swap value out of range ($10 - $50,000)' },
        { status: 400 }
      );
    }

    // Calculate output
    const outputValueUsd = valueUsd * 0.997;
    const outputAmount = outputValueUsd / outputPriceUsd;
    const serviceFeeAmount = outputAmount * (SERVICE_FEE_PERCENT / 100);
    const outputAmountAfterFee = outputAmount - serviceFeeAmount;

    // Estimate gas cost (will be covered by platform)
    const estimatedGasUsd = chainId === 1 ? 15 : chainId === 137 ? 0.5 : 2;

    return NextResponse.json({
      inputAmount,
      outputAmount: outputAmount.toFixed(8),
      outputAmountAfterFee: outputAmountAfterFee.toFixed(8),
      serviceFeePercent: SERVICE_FEE_PERCENT,
      serviceFeeAmount: serviceFeeAmount.toFixed(8),
      serviceFeeUsd: serviceFeeAmount * outputPriceUsd,
      estimatedGasUsd,
      platformCoversGas: true,
      route: 'delegated',
      routeDescription: 'Gasless swap - Platform sponsors gas, 1% service fee',
      estimatedTime: '~30s - 2min',
      quoteId: `dq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      expiresAt: Date.now() + 60000,
    });
  } catch (error) {
    console.error('[Delegated Quote] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quote' },
      { status: 500 }
    );
  }
}
