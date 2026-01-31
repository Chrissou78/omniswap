// apps/web/src/app/api/ads/bookings/[id]/pay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await request.json();
    const { txHash, chainId, tokenSymbol, tokenAddress, amount } = data;

    if (!txHash || !chainId || !tokenSymbol || !amount) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    // Get booking
    const booking = await prisma.adBooking.findUnique({
      where: { id },
      include: { advertiser: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ error: 'Booking already paid' }, { status: 400 });
    }

    // Get config for platform wallet
    const config = await prisma.adConfig.findUnique({ where: { id: 'default' } });
    const platformWallets = (config?.platformWallets as Record<string, string>) || {};
    const toAddress = platformWallets[chainId.toString()] || '';

    // Create payment record
    const payment = await prisma.adPayment.create({
      data: {
        bookingId: booking.id,
        advertiserId: booking.advertiserId,
        amountUsd: amount,
        amountToken: amount, // Assuming stablecoin
        tokenSymbol,
        tokenAddress: tokenAddress || '',
        chainId: chainId.toString(),
        txHash,
        fromAddress: booking.advertiser.walletAddress,
        toAddress,
        status: 'CONFIRMING',
      },
    });

    // Update booking status
    await prisma.adBooking.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' },
    });

    // TODO: Verify transaction on-chain
    // For now, auto-confirm after a delay (in production, use a webhook or cron)
    setTimeout(async () => {
      try {
        await prisma.adPayment.update({
          where: { id: payment.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
      } catch (e) {
        console.error('Payment confirmation error:', e);
      }
    }, 5000);

    return NextResponse.json({ success: true, paymentId: payment.id });
  } catch (error) {
    console.error('Payment error:', error);
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
  }
}
