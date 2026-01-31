// apps/web/src/app/api/admin/ads/slots/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const slots = await prisma.adSlot.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { bookings: true } },
      },
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error('Slots fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();

    const slot = await prisma.adSlot.create({
      data: {
        name: data.name,
        position: data.position,
        width: data.width,
        height: data.height,
        pricePerDayUsd: data.pricePerDayUsd,
        description: data.description || null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'CREATE',
        entity: 'AdSlot',
        entityId: slot.id,
        details: { name: slot.name },
      },
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    console.error('Slot create error:', error);
    return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
  }
}
