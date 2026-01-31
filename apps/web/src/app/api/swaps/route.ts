// apps/web/src/app/api/swaps/route.ts
import { NextRequest, NextResponse } from 'next/server';

// In production, use a real database (PostgreSQL, MongoDB, etc.)
// This is a simple in-memory store for demonstration
const swapStore: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const swap = await request.json();
    swapStore.unshift(swap);
    
    // Keep last 10000 swaps in memory
    if (swapStore.length > 10000) {
      swapStore.pop();
    }
    
    return NextResponse.json({ success: true, id: swap.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to record swap' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(swapStore.slice(0, 100));
}
