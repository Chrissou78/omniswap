import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
    }

    await prisma.adBooking.update({
      where: { id: bookingId },
      data: { impressions: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to track impression:', error);
    return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
  }
}
