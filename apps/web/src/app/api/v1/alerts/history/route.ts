// apps/web/src/app/api/v1/alerts/history/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/user-auth';
import { toUiAlertHistory } from '@/lib/alerts';

export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const history = await prisma.alertHistory.findMany({
      where: { userId: session.userId },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ history: history.map(toUiAlertHistory) });
  } catch (error) {
    console.error('Alert history fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch alert history' }, { status: 500 });
  }
}
