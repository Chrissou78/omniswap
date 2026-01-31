import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const AD_SLOTS = [
  {
    id: 'header-banner',
    name: 'Header Banner',
    description: 'Premium banner at the top of every page - maximum visibility',
    position: 'header',
    dimensions: '728x90',
    width: 728,
    height: 90,
    basePrice: 50, // $50/day
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'sidebar-left-top',
    name: 'Left Sidebar - Top',
    description: 'Prime left sidebar position next to swap widget',
    position: 'sidebar',
    dimensions: '300x250',
    width: 300,
    height: 250,
    basePrice: 35, // $35/day
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'sidebar-left-bottom',
    name: 'Left Sidebar - Bottom',
    description: 'Secondary left sidebar position below top ad',
    position: 'sidebar',
    dimensions: '300x250',
    width: 300,
    height: 250,
    basePrice: 25, // $25/day
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'sidebar-right-top',
    name: 'Right Sidebar - Top',
    description: 'Prime right sidebar position next to swap widget',
    position: 'sidebar',
    dimensions: '300x250',
    width: 300,
    height: 250,
    basePrice: 35, // $35/day
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'sidebar-right-bottom',
    name: 'Right Sidebar - Bottom',
    description: 'Secondary right sidebar position below top ad',
    position: 'sidebar',
    dimensions: '300x250',
    width: 300,
    height: 250,
    basePrice: 25, // $25/day
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'swap-widget',
    name: 'Swap Widget Banner',
    description: 'Compact banner directly below the swap interface',
    position: 'swap',
    dimensions: '300x100',
    width: 300,
    height: 100,
    basePrice: 40, // $40/day
    sortOrder: 6,
    isActive: true,
  },
  {
    id: 'footer-banner',
    name: 'Footer Banner',
    description: 'Site-wide footer banner on all pages',
    position: 'footer',
    dimensions: '728x90',
    width: 728,
    height: 90,
    basePrice: 30, // $30/day
    sortOrder: 7,
    isActive: true,
  },
];

export async function GET() {
  return handleSeed();
}

export async function POST() {
  return handleSeed();
}

async function handleSeed() {
  try {
    const results = [];

    for (const slot of AD_SLOTS) {
      const upserted = await prisma.adSlot.upsert({
        where: { id: slot.id },
        update: {
          name: slot.name,
          description: slot.description,
          position: slot.position,
          dimensions: slot.dimensions,
          width: slot.width,
          height: slot.height,
          basePrice: slot.basePrice,
          sortOrder: slot.sortOrder,
          isActive: slot.isActive,
        },
        create: slot,
      });
      results.push(upserted);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} ad slots`,
      slots: results,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed ad slots', details: String(error) },
      { status: 500 }
    );
  }
}