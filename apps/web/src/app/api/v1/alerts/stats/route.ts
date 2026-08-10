// apps/web/src/app/api/v1/alerts/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/user-auth';

export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalAlerts, activeAlerts, triggeredToday, triggeredTotal] = await Promise.all([
      prisma.priceAlert.count({ where: { userId: session.userId } }),
      prisma.priceAlert.count({ where: { userId: session.userId, status: 'ACTIVE' } }),
      prisma.alertHistory.count({
        where: { userId: session.userId, triggeredAt: { gte: startOfToday } },
      }),
      prisma.alertHistory.count({ where: { userId: session.userId } }),
    ]);

    // The alerts page reads these fields off the response body directly.
    return NextResponse.json({ totalAlerts, activeAlerts, triggeredToday, triggeredTotal });
  } catch (error) {
    console.error('Alert stats failed:', error);
    return NextResponse.json({ error: 'Failed to fetch alert stats' }, { status: 500 });
  }
}
