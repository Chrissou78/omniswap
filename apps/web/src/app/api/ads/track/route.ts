// apps/web/src/app/api/ads/track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { bookingId, type } = await request.json();

    if (!bookingId || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (type === 'impression') {
      await prisma.adBooking.update({
        where: { id: bookingId },
        data: { impressions: { increment: 1 } },
      });
    } else if (type === 'click') {
      await prisma.adBooking.update({
        where: { id: bookingId },
        data: { clicks: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
  }
}
