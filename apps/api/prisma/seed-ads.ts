import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slots = [
    {
      id: 'header-banner',
      name: 'Header Banner',
      position: 'header',
      dimensions: '728x90',
      width: 728,
      height: 90,
      basePrice: 50.0,
      description: 'Premium banner at the top of the page',
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'sidebar-left-top',
      name: 'Sidebar Left Top',
      position: 'sidebar-left',
      dimensions: '300x250',
      width: 300,
      height: 250,
      basePrice: 30.0,
      description: 'Visible on all pages',
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 'sidebar-right-bottom',
      name: 'Sidebar Right Bottom',
      position: 'sidebar-right',
      dimensions: '300x250',
      width: 300,
      height: 250,
      basePrice: 25.0,
      description: 'Below the swap widget',
      isActive: true,
      sortOrder: 3,
    },
    {
      id: 'swap-widget',
      name: 'Swap Widget Ad',
      position: 'swap-widget',
      dimensions: '300x100',
      width: 300,
      height: 100,
      basePrice: 40.0,
      description: 'Inside the swap interface',
      isActive: true,
      sortOrder: 4,
    },
    {
      id: 'footer-banner',
      name: 'Footer Banner',
      position: 'footer',
      dimensions: '728x90',
      width: 728,
      height: 90,
      basePrice: 20.0,
      description: 'Banner at the bottom of the page',
      isActive: true,
      sortOrder: 5,
    },
  ];

  for (const slot of slots) {
    await prisma.adSlot.upsert({
      where: { id: slot.id },
      update: slot,
      create: slot,
    });
  }

  console.log('Ad slots seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
