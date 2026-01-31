// apps/web/src/app/api/admin/ads/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  try {
    const bookings = await prisma.adBooking.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        advertiser: { select: { walletAddress: true, companyName: true } },
        slot: { select: { name: true, position: true } },
        payments: { select: { status: true, amountUsd: true, txHash: true } },
      },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Bookings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
