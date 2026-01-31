// apps/web/src/app/api/admin/ads/bookings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const booking = await prisma.adBooking.findUnique({
      where: { id },
      include: {
        advertiser: true,
        slot: true,
        payments: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Booking fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const data = await request.json();

    const updateData: any = {};

    if (data.status === 'APPROVED') {
      updateData.status = 'APPROVED';
      updateData.approvedAt = new Date();
    } else if (data.status === 'REJECTED') {
      updateData.status = 'REJECTED';
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = data.rejectionReason || null;
    } else if (data.status === 'ACTIVE') {
      updateData.status = 'ACTIVE';
    } else if (data.status) {
      updateData.status = data.status;
    }

    const booking = await prisma.adBooking.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'UPDATE',
        entity: 'AdBooking',
        entityId: booking.id,
        details: data,
      },
    });

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Booking update error:', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}
