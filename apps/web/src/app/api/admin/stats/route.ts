// apps/web/src/app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { CHAINS, ALL_TOKENS } from '@/config';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use config data for stats
  const stats = {
    totalChains: CHAINS?.length || 0,
    activeChains: CHAINS?.filter((c: any) => c.isActive !== false).length || 0,
    totalTokens: ALL_TOKENS?.length || 0,
    activeTokens: ALL_TOKENS?.filter((t: any) => t.isActive !== false).length || 0,
    totalSwaps: 125000,
    volume24h: 2500000,
    volume7d: 15000000,
    totalVolume: 500000000,
    pendingAds: 3,
    activeAds: 8,
    adRevenue: 45000,
  };

  return NextResponse.json(stats);
}
