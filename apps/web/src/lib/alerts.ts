// apps/web/src/lib/alerts.ts
//
// Shared mapping + evaluation logic for price alerts. Lives here (not in
// packages/core, which is excluded from the deploy and written against an
// older schema) so both the API routes and the cron checker use one source
// of truth.

import type { AlertType } from '@prisma/client';

/** UI-facing alert type strings <-> Prisma AlertType enum. */
export const UI_TO_DB_ALERT_TYPE: Record<string, AlertType> = {
  above: 'PRICE_ABOVE',
  below: 'PRICE_BELOW',
  percent_change: 'PRICE_CHANGE_PERCENT',
};

export const DB_TO_UI_ALERT_TYPE: Record<string, 'above' | 'below' | 'percent_change'> = {
  PRICE_ABOVE: 'above',
  PRICE_BELOW: 'below',
  PRICE_CHANGE_PERCENT: 'percent_change',
};

/** Shape the alerts page expects for each alert. */
export function toUiAlert(row: any) {
  return {
    id: row.id,
    userId: row.userId,
    tokenAddress: row.tokenAddress,
    tokenSymbol: row.tokenSymbol,
    tokenName: row.tokenName ?? row.tokenSymbol,
    tokenLogoURI: row.tokenLogoURI ?? undefined,
    chainId: row.chainId,
    alertType: DB_TO_UI_ALERT_TYPE[row.type] ?? 'above',
    targetPrice: row.targetPrice ?? undefined,
    targetPercentChange: row.targetPercentChange ?? undefined,
    currentPrice: row.currentPrice ?? 0,
    priceAtCreation: row.priceAtCreation ?? 0,
    isEnabled: row.status === 'ACTIVE',
    isRecurring: row.isRecurring,
    cooldownMinutes: row.cooldownMinutes,
    lastTriggeredAt: row.triggeredAt ? new Date(row.triggeredAt).toISOString() : undefined,
    triggerCount: row.triggerCount ?? 0,
    notifyEmail: row.notifyEmail,
    notifyPush: row.notifyPush,
    notifyTelegram: row.notifyTelegram,
    telegramChatId: row.telegramChatId ?? undefined,
    note: row.note ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Shape the alerts page expects for history rows. */
export function toUiAlertHistory(row: any) {
  return {
    id: row.id,
    alertId: row.alertId,
    tokenSymbol: row.tokenSymbol,
    tokenLogoURI: row.tokenLogoURI ?? undefined,
    chainId: row.chainId,
    alertType: DB_TO_UI_ALERT_TYPE[row.type] ?? 'above',
    targetPrice: row.targetPrice ?? undefined,
    targetPercentChange: row.targetPercentChange ?? undefined,
    triggeredPrice: row.triggeredPrice,
    notificationsSent: row.notificationsSent ?? [],
    triggeredAt: new Date(row.triggeredAt).toISOString(),
  };
}

/**
 * Decide whether an alert's condition is met at the given price.
 * Percent-change alerts compare against the price when the alert was created.
 */
export function shouldTrigger(alert: {
  type: AlertType;
  targetPrice: number | null;
  targetPercentChange: number | null;
  priceAtCreation: number | null;
}, currentPrice: number): boolean {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return false;

  switch (alert.type) {
    case 'PRICE_ABOVE':
      return alert.targetPrice != null && currentPrice >= alert.targetPrice;
    case 'PRICE_BELOW':
      return alert.targetPrice != null && currentPrice <= alert.targetPrice;
    case 'PRICE_CHANGE_PERCENT': {
      const base = alert.priceAtCreation;
      const threshold = alert.targetPercentChange;
      if (!base || base <= 0 || threshold == null) return false;
      const changePct = ((currentPrice - base) / base) * 100;
      return Math.abs(changePct) >= Math.abs(threshold);
    }
    default:
      return false;
  }
}

/** Respect the per-alert cooldown so a recurring alert doesn't spam. */
export function isCooledDown(lastNotifiedAt: Date | null, cooldownMinutes: number): boolean {
  if (!lastNotifiedAt) return true;
  return Date.now() - new Date(lastNotifiedAt).getTime() >= cooldownMinutes * 60 * 1000;
}
