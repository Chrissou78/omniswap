// apps/web/src/app/api/v1/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/user-auth';
import { getServerTokenPrice } from '@/lib/serverPrice';
import { UI_TO_DB_ALERT_TYPE, toUiAlert } from '@/lib/alerts';

export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ alerts: alerts.map(toUiAlert) });
  } catch (error) {
    console.error('Alerts fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      tokenAddress,
      tokenSymbol,
      tokenName,
      tokenLogoURI,
      chainId,
      alertType,
      targetPrice,
      targetPercentChange,
      isRecurring,
      cooldownMinutes,
      notifyEmail,
      notifyPush,
      notifyTelegram,
      telegramChatId,
      note,
    } = body;

    if (!tokenAddress || !tokenSymbol || !chainId || !alertType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dbType = UI_TO_DB_ALERT_TYPE[alertType];
    if (!dbType) {
      return NextResponse.json({ error: `Unsupported alert type "${alertType}"` }, { status: 400 });
    }

    if (dbType === 'PRICE_CHANGE_PERCENT') {
      if (targetPercentChange == null) {
        return NextResponse.json(
          { error: 'targetPercentChange is required for percent-change alerts' },
          { status: 400 }
        );
      }
    } else if (targetPrice == null) {
      return NextResponse.json(
        { error: 'targetPrice is required for above/below alerts' },
        { status: 400 }
      );
    }

    // Record the real current price so percent-change alerts have a genuine
    // baseline (and the UI can show drift since creation).
    let priceAtCreation: number | null = null;
    try {
      const price = await getServerTokenPrice(chainId, tokenAddress);
      priceAtCreation = price?.priceUsd ?? null;
    } catch {
      // Non-fatal: an above/below alert still works without a baseline.
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId: session.userId,
        chainId: String(chainId),
        tokenAddress,
        tokenSymbol,
        tokenName: tokenName || null,
        tokenLogoURI: tokenLogoURI || null,
        type: dbType,
        // targetPrice is non-null in the schema; percent alerts keep 0 here and
        // carry their threshold in targetPercentChange.
        targetPrice: dbType === 'PRICE_CHANGE_PERCENT' ? 0 : Number(targetPrice),
        targetPercentChange:
          dbType === 'PRICE_CHANGE_PERCENT' ? Number(targetPercentChange) : null,
        priceAtCreation,
        currentPrice: priceAtCreation,
        isRecurring: Boolean(isRecurring),
        cooldownMinutes: Number(cooldownMinutes) || 60,
        notifyEmail: notifyEmail ?? true,
        notifyPush: notifyPush ?? true,
        notifyTelegram: notifyTelegram ?? false,
        telegramChatId: telegramChatId || null,
        note: note || null,
      },
    });

    return NextResponse.json(toUiAlert(alert), { status: 201 });
  } catch (error) {
    console.error('Alert creation failed:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
