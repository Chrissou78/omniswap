import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const slots = await prisma.adSlot.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    
    return NextResponse.json(slots);
  } catch (error) {
    console.error('Failed to fetch ad slots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad slots' },
      { status: 500 }
    );
  }
}
