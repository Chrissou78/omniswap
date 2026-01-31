// packages/database/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default admin
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  await prisma.admin.upsert({
    where: { email: 'admin@omniswap.com' },
    update: {},
    create: {
      email: 'admin@omniswap.com',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  // Create default ad config
  await prisma.adConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      platformFeePercent: 50,
      minBookingDays: 1,
      maxBookingDays: 90,
      requireApproval: true,
      supportedTokens: [
        { chainId: '1', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT' },
        { chainId: '1', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC' },
      ],
      platformWallets: {
        '1': '0x...', // Your Ethereum wallet
        '56': '0x...', // Your BSC wallet
      },
    },
  });

  // Create default ad slots
  const slots = [
    { name: 'Swap Top Banner', position: 'swap-top', width: 728, height: 90, pricePerDayUsd: 50 },
    { name: 'Swap Bottom Banner', position: 'swap-bottom', width: 728, height: 90, pricePerDayUsd: 30 },
    { name: 'Sidebar Left', position: 'sidebar-left', width: 300, height: 250, pricePerDayUsd: 25 },
    { name: 'Sidebar Right', position: 'sidebar-right', width: 300, height: 250, pricePerDayUsd: 25 },
  ];

  for (const slot of slots) {
    await prisma.adSlot.upsert({
      where: { id: slot.position },
      update: slot,
      create: { id: slot.position, ...slot, isActive: true },
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
