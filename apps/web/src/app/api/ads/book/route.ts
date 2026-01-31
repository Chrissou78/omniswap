import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slotId,
      startDate,
      days,
      imageUrl,
      targetUrl,
      altText,
      email,
      companyName,
      contactName,
      pricing,
      payment, // New: payment info included
    } = body;

    // Validate required fields
    if (!slotId || !startDate || !days || !imageUrl || !targetUrl || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Payment is required
    if (!payment?.txHash) {
      return NextResponse.json(
        { error: 'Payment transaction hash is required' },
        { status: 400 }
      );
    }

    // Get slot to verify it exists
    const slot = await prisma.adSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return NextResponse.json(
        { error: 'Ad slot not found' },
        { status: 404 }
      );
    }

    // Calculate end date
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);

    // Check for conflicts (overlapping bookings)
    const conflicts = await prisma.adBooking.findMany({
      where: {
        slotId,
        status: {
          in: ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE'],
        },
        OR: [
          {
            AND: [
              { startDate: { lte: start } },
              { endDate: { gte: start } },
            ],
          },
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: end } },
            ],
          },
          {
            AND: [
              { startDate: { gte: start } },
              { endDate: { lte: end } },
            ],
          },
        ],
      },
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: 'This slot is already booked for the selected dates' },
        { status: 409 }
      );
    }

    // Get settings for approval requirement
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 'default' },
    });

    // Create booking with payment already recorded
    const booking = await prisma.adBooking.create({
      data: {
        slotId,
        email,
        companyName,
        contactName,
        startDate: start,
        endDate: end,
        days,
        imageUrl,
        targetUrl,
        altText,
        basePricePerDay: pricing.basePricePerDay,
        volumeDiscountPct: pricing.volumeDiscountPct,
        advanceDiscountPct: pricing.advanceDiscountPct,
        totalDiscountPct: pricing.totalDiscountPct,
        subtotal: pricing.subtotal,
        discountAmount: pricing.totalDiscountAmount,
        finalPrice: pricing.finalPrice,
        requiresApproval: settings?.adRequiresApproval ?? true,
        // Payment info - already paid!
        paymentStatus: 'PAID',
        paymentChainId: payment.chainId,
        paymentMethod: payment.token,
        paymentTxHash: payment.txHash,
        paidAt: new Date(),
        // Status is pending approval (not pending payment)
        status: settings?.adRequiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
      },
    });

    console.log('Created ad booking with payment:', booking.id, 'txHash:', payment.txHash);

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Failed to create booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
