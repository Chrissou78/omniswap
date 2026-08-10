// apps/web/src/app/api/admin/ads/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalSlots,
      activeSlots,
      pendingRequests,
      activeBookings,
      completedBookings,
      revenueAll,
      revenueMonth,
      engagement,
    ] = await Promise.all([
      prisma.adSlot.count(),
      prisma.adSlot.count({ where: { isActive: true } }),
      prisma.adBooking.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.adBooking.count({ where: { status: 'ACTIVE' } }),
      prisma.adBooking.count({ where: { status: 'COMPLETED' } }),
      prisma.adBooking.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { finalPrice: true },
      }),
      prisma.adBooking.aggregate({
        where: { paymentStatus: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { finalPrice: true },
      }),
      prisma.adBooking.aggregate({
        _sum: { impressions: true, clicks: true },
      }),
    ]);

    return NextResponse.json({
      totalSlots,
      activeSlots,
      pendingRequests,
      activeBookings,
      completedBookings,
      totalRevenue: revenueAll._sum.finalPrice ?? 0,
      monthlyRevenue: revenueMonth._sum.finalPrice ?? 0,
      totalImpressions: engagement._sum.impressions ?? 0,
      totalClicks: engagement._sum.clicks ?? 0,
    });
  } catch (error) {
    console.error('Ad stats fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ad stats' }, { status: 500 });
  }
}
