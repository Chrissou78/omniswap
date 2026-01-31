import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { listingId, chainId, token, txHash } = await request.json();

    if (!listingId || !chainId || !token || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update listing with payment info
    const listing = await prisma.tokenListingRequest.update({
      where: { id: listingId },
      data: {
        paymentChainId: String(chainId),
        paymentMethod: token,
        paymentTxHash: txHash,
        paymentStatus: 'PENDING',
        status: 'PENDING_REVIEW',
      },
    });

    console.log('Payment submitted for listing:', listingId, 'txHash:', txHash);

    return NextResponse.json({
      success: true,
      listingId: listing.id,
      status: listing.status,
    });
  } catch (error) {
    console.error('Failed to process payment:', error);
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
