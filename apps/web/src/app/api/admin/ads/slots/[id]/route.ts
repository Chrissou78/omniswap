// apps/web/src/app/api/admin/ads/slots/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';

export async function PUT(
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

    const slot = await prisma.adSlot.update({
      where: { id },
      data: {
        name: data.name,
        position: data.position,
        width: data.width,
        height: data.height,
        pricePerDayUsd: data.pricePerDayUsd,
        description: data.description,
      },
    });

    return NextResponse.json(slot);
  } catch (error) {
    console.error('Slot update error:', error);
    return NextResponse.json({ error: 'Failed to update slot' }, { status: 500 });
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

    const slot = await prisma.adSlot.update({
      where: { id },
      data,
    });

    return NextResponse.json(slot);
  } catch (error) {
    console.error('Slot patch error:', error);
    return NextResponse.json({ error: 'Failed to update slot' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.adSlot.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Slot delete error:', error);
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 });
  }
}
