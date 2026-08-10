// apps/web/src/app/api/v1/alerts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/user-auth';
import { UI_TO_DB_ALERT_TYPE, toUiAlert } from '@/lib/alerts';

/**
 * Every handler scopes its write to { id, userId } so one user can never touch
 * another user's alert, even with a valid session and a guessed id.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (typeof body.isEnabled === 'boolean') {
      data.status = body.isEnabled ? 'ACTIVE' : 'DISABLED';
    }
    if (body.alertType) {
      const dbType = UI_TO_DB_ALERT_TYPE[body.alertType];
      if (!dbType) {
        return NextResponse.json({ error: 'Unsupported alert type' }, { status: 400 });
      }
      data.type = dbType;
    }
    if (body.targetPrice != null) data.targetPrice = Number(body.targetPrice);
    if (body.targetPercentChange != null) {
      data.targetPercentChange = Number(body.targetPercentChange);
    }
    if (typeof body.isRecurring === 'boolean') data.isRecurring = body.isRecurring;
    if (body.cooldownMinutes != null) data.cooldownMinutes = Number(body.cooldownMinutes);
    if (typeof body.notifyEmail === 'boolean') data.notifyEmail = body.notifyEmail;
    if (typeof body.notifyPush === 'boolean') data.notifyPush = body.notifyPush;
    if (typeof body.notifyTelegram === 'boolean') data.notifyTelegram = body.notifyTelegram;
    if (body.telegramChatId !== undefined) data.telegramChatId = body.telegramChatId || null;
    if (body.note !== undefined) data.note = body.note || null;

    const result = await prisma.priceAlert.updateMany({
      where: { id, userId: session.userId },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const updated = await prisma.priceAlert.findUnique({ where: { id } });
    return NextResponse.json(updated ? toUiAlert(updated) : { ok: true });
  } catch (error) {
    console.error('Alert update failed:', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;

  try {
    const result = await prisma.priceAlert.deleteMany({
      where: { id, userId: session.userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Alert delete failed:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
