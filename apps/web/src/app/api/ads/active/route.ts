// apps/web/src/app/api/ads/active/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');

    if (!slotId) {
      return NextResponse.json({ error: 'slotId required' }, { status: 400 });
    }

    const now = new Date();

    // Find active booking for this slot
    const booking = await prisma.adBooking.findFirst({
      where: {
        slotId,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!booking) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: booking.id,
      imageUrl: booking.imageUrl,
      targetUrl: booking.targetUrl,
      altText: booking.altText,
    });
  } catch (error) {
    console.error('Failed to fetch active ad:', error);
    return NextResponse.json(null);
  }
}
