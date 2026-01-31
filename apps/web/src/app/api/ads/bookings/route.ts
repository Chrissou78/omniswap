// apps/web/src/app/api/ads/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const { walletAddress, slotId, imageUrl, targetUrl, altText, startDate, endDate } = data;

    if (!walletAddress || !slotId || !imageUrl || !targetUrl || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get or create advertiser
    let advertiser = await prisma.advertiser.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!advertiser) {
      advertiser = await prisma.advertiser.create({
        data: { walletAddress: walletAddress.toLowerCase() },
      });
    }

    // Get slot for pricing
    const slot = await prisma.adSlot.findUnique({ where: { id: slotId } });
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    // Calculate price
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalPriceUsd = days * slot.pricePerDayUsd.toNumber();
    const platformFeeUsd = totalPriceUsd * 0.5; // 50% platform fee

    // Check availability
    const conflicting = await prisma.adBooking.findFirst({
      where: {
        slotId,
        status: { in: ['APPROVED', 'ACTIVE'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (conflicting) {
      return NextResponse.json({ error: 'Slot not available for selected dates' }, { status: 400 });
    }

    // Create booking
    const booking = await prisma.adBooking.create({
      data: {
        advertiserId: advertiser.id,
        slotId,
        imageUrl,
        targetUrl,
        altText: altText || null,
        startDate: start,
        endDate: end,
        totalPriceUsd,
        platformFeeUsd,
        status: 'PENDING_PAYMENT',
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Booking create error:', error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
