// apps/web/src/app/api/admin/listings/[id]/route.ts
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
    const listing = await prisma.tokenListingRequest.findUnique({ where: { id } });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Listing fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
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
    const updateData: Record<string, unknown> = {};

    switch (data.status) {
      case 'UNDER_REVIEW':
        updateData.status = 'UNDER_REVIEW';
        updateData.reviewedAt = new Date();
        updateData.reviewedBy = admin.id;
        break;
      case 'APPROVED':
      case 'LISTED':
        updateData.status = data.status;
        updateData.reviewedAt = new Date();
        updateData.reviewedBy = admin.id;
        break;
      case 'REJECTED':
        updateData.status = 'REJECTED';
        updateData.reviewedAt = new Date();
        updateData.reviewedBy = admin.id;
        updateData.rejectedReason = data.rejectionReason || null;
        break;
      default:
        if (data.status) updateData.status = data.status;
    }

    if (typeof data.adminNotes === 'string') {
      updateData.adminNotes = data.adminNotes;
    }

    const listing = await prisma.tokenListingRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Listing update error:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}
