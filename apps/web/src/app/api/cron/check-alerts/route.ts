// apps/web/src/app/api/cron/check-alerts/route.ts
//
// Re-checks every ACTIVE price alert against its real current price and
// triggers the ones whose condition is met. Called on a schedule by
// .github/workflows/check-alerts.yml (Vercel's Hobby plan only allows
// once-daily cron, which is far too infrequent for price alerts).
//
// Protected by CRON_SECRET - without it this endpoint refuses to run rather
// than being publicly triggerable.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenPrice } from '@/services/priceService';
import { shouldTrigger, isCooledDown } from '@/lib/alerts';

export const maxDuration = 60;

async function sendAlertEmail(params: {
  to: string;
  tokenSymbol: string;
  triggeredPrice: number;
  note?: string | null;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM;
  if (!apiKey || !from) return false; // optional feature - alert still triggers in-app

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `${params.tokenSymbol} price alert triggered`,
        text: [
          `Your OmniSwap price alert for ${params.tokenSymbol} has triggered.`,
          `Current price: $${params.triggeredPrice}`,
          params.note ? `Your note: ${params.note}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      }),
    });
    return res.ok;
  } catch (error) {
    console.warn('Alert email send failed:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const alerts = await prisma.priceAlert.findMany({
    where: { status: 'ACTIVE' },
    include: { user: { select: { email: true } } },
    take: 500,
  });

  let checked = 0;
  let triggered = 0;
  const errors: string[] = [];

  for (const alert of alerts) {
    checked++;
    try {
      const price = await getTokenPrice(alert.chainId, alert.tokenAddress, alert.tokenSymbol);
      const currentPrice = price?.priceUsd;
      if (currentPrice == null) continue;

      // Always record the latest observed price, even when not triggering.
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { currentPrice },
      });

      if (!shouldTrigger(alert, currentPrice)) continue;
      if (!isCooledDown(alert.lastNotifiedAt, alert.cooldownMinutes)) continue;

      const notificationsSent: string[] = [];
      if (alert.notifyEmail && alert.user?.email) {
        const sent = await sendAlertEmail({
          to: alert.user.email,
          tokenSymbol: alert.tokenSymbol,
          triggeredPrice: currentPrice,
          note: alert.note,
        });
        if (sent) notificationsSent.push('email');
      }

      await prisma.$transaction([
        prisma.alertHistory.create({
          data: {
            alertId: alert.id,
            userId: alert.userId,
            tokenSymbol: alert.tokenSymbol,
            tokenLogoURI: alert.tokenLogoURI,
            chainId: alert.chainId,
            type: alert.type,
            targetPrice: alert.type === 'PRICE_CHANGE_PERCENT' ? null : alert.targetPrice,
            targetPercentChange: alert.targetPercentChange,
            triggeredPrice: currentPrice,
            notificationsSent,
          },
        }),
        prisma.priceAlert.update({
          where: { id: alert.id },
          data: {
            // Recurring alerts stay ACTIVE (cooldown throttles them); one-shot
            // alerts are marked TRIGGERED so they don't fire again.
            status: alert.isRecurring ? 'ACTIVE' : 'TRIGGERED',
            triggeredAt: new Date(),
            lastNotifiedAt: new Date(),
            triggerCount: { increment: 1 },
          },
        }),
      ]);

      triggered++;
    } catch (error: any) {
      errors.push(`${alert.id}: ${error?.message || 'unknown error'}`);
    }
  }

  return NextResponse.json({ checked, triggered, errors });
}
