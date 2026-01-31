import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let settings = await prisma.platformSettings.findUnique({
      where: { id: 'default' },
    });
    
    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          id: 'default',
          adBasePricePerDay: 100,
          adRequiresApproval: true,
          adVolumeDiscounts: [
            { minDays: 7, discountPct: 5 },
            { minDays: 14, discountPct: 10 },
            { minDays: 30, discountPct: 20 },
            { minDays: 60, discountPct: 30 },
          ],
          adAdvanceDiscountPerDay: 1,
          adAdvanceDiscountPerWeek: 2,
          adMaxAdvanceDiscountPct: 30,
          tokenListingFee: 300,
          tokenListingRequiresApproval: true,
          acceptedPaymentChains: [1, 137, 42161],
        },
      });
    }
    
    return NextResponse.json({
      basePricePerDay: settings.adBasePricePerDay,
      requiresApproval: settings.adRequiresApproval,
      volumeDiscounts: settings.adVolumeDiscounts,
      advanceDiscountPerDay: settings.adAdvanceDiscountPerDay,
      advanceDiscountPerWeek: settings.adAdvanceDiscountPerWeek,
      maxAdvanceDiscountPct: settings.adMaxAdvanceDiscountPct,
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}
