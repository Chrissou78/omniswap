// apps/web/src/lib/adPricing.ts
//
// Single source of truth for ad-slot pricing, shared by the booking UI and the
// server-side booking route. The server MUST recompute price from this rather
// than trusting a client-supplied `pricing` object - otherwise a caller could
// claim a $0.01 price and "verify" a $0.01 payment for a real ad slot.

export interface AdPricing {
  basePricePerDay: number;
  days: number;
  volumeDiscountPct: number;
  advanceDiscountPct: number;
  totalDiscountPct: number;
  subtotal: number;
  discountAmount: number;
  finalPrice: number;
}

/** Volume discount based on campaign duration. */
export function getVolumeDiscountPct(days: number): number {
  if (days >= 30) return 20;
  if (days >= 14) return 10;
  if (days >= 7) return 5;
  return 0;
}

/** Advance-booking discount: 1%/day + 2% bonus per week, capped at 30%. */
export function getAdvanceDiscountPct(startDate: Date, now: Date = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const daysInAdvance = Math.max(
    0,
    Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );
  return Math.min(daysInAdvance + Math.floor(daysInAdvance / 7) * 2, 30);
}

/** Total discount, capped at 50%. */
export function getTotalDiscountPct(days: number, startDate: Date, now?: Date): number {
  return Math.min(getVolumeDiscountPct(days) + getAdvanceDiscountPct(startDate, now), 50);
}

/** Compute the full pricing breakdown for a single slot. */
export function computeAdPricing(params: {
  basePricePerDay: number;
  days: number;
  startDate: Date;
  now?: Date;
}): AdPricing {
  const { basePricePerDay, days, startDate, now } = params;

  const volumeDiscountPct = getVolumeDiscountPct(days);
  const advanceDiscountPct = getAdvanceDiscountPct(startDate, now);
  const totalDiscountPct = Math.min(volumeDiscountPct + advanceDiscountPct, 50);

  const subtotal = basePricePerDay * days;
  const finalPrice = Math.round(subtotal * (1 - totalDiscountPct / 100));
  const discountAmount = Math.round(subtotal * (totalDiscountPct / 100));

  return {
    basePricePerDay,
    days,
    volumeDiscountPct,
    advanceDiscountPct,
    totalDiscountPct,
    subtotal,
    discountAmount,
    finalPrice,
  };
}
