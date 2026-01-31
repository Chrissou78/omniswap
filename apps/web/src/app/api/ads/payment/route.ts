import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { bookingId, chainId, token, txHash } = await request.json();

    if (!bookingId || !chainId || !token || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update booking with payment info
    const booking = await prisma.adBooking.update({
      where: { id: bookingId },
      data: {
        paymentChainId: String(chainId),
        paymentMethod: token,
        paymentTxHash: txHash,
        paymentStatus: 'PENDING', // Will be verified manually or via webhook
        status: 'PENDING_APPROVAL', // Move to approval stage
      },
    });

    console.log('Payment submitted for booking:', bookingId, 'txHash:', txHash);

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      status: booking.status,
    });
  } catch (error) {
    console.error('Failed to process payment:', error);
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
