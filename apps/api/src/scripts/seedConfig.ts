// apps/api/src/scripts/seedConfig.ts
import { PrismaClient } from '@prisma/client';
import { CHAINS, TOKENS } from '@omniswap/shared';

const prisma = new PrismaClient();

async function seedConfig() {
  console.log('Seeding chains and tokens...');

  // Seed chains
  console.log(`Seeding ${CHAINS.length} chains...`);
  for (const chain of CHAINS) {
    await prisma.chain.upsert({
      where: { chainId: String(chain.id) },
      update: {
        name: chain.name,
        symbol: chain.symbol,
        color: chain.color,
        type: chain.type,
        trustwalletId: chain.trustwalletId,
        dexscreenerId: chain.dexscreenerId,
        defillamaId: chain.defillamaId,
        coingeckoAssetPlatform: chain.coingeckoAssetPlatform,
        wrappedNativeAddress: chain.wrappedNativeAddress,
        rpcEnvKey: chain.rpcEnvKey,
        rpcDefault: chain.rpcDefault,
        explorerUrl: chain.explorerUrl,
        explorerName: chain.explorerName,
        popularity: chain.popularity,
        updatedAt: new Date(),
      },
      create: {
        chainId: String(chain.id),
        name: chain.name,
        symbol: chain.symbol,
        color: chain.color,
        type: chain.type,
        trustwalletId: chain.trustwalletId,
        dexscreenerId: chain.dexscreenerId,
        defillamaId: chain.defillamaId,
        coingeckoAssetPlatform: chain.coingeckoAssetPlatform,
        wrappedNativeAddress: chain.wrappedNativeAddress,
        rpcEnvKey: chain.rpcEnvKey,
        rpcDefault: chain.rpcDefault,
        explorerUrl: chain.explorerUrl,
        explorerName: chain.explorerName,
        popularity: chain.popularity,
        isActive: true,
      },
    });
  }
  console.log('Chains seeded.');

  // Seed tokens
  console.log(`Seeding ${TOKENS.length} tokens...`);
  for (const token of TOKENS) {
    const uniqueId = `${token.chainId}_${token.address.toLowerCase()}`;
    await prisma.token.upsert({
      where: { uniqueId },
      update: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        tags: JSON.stringify(token.tags || []),
        popularity: token.popularity,
        coingeckoId: token.coingeckoId,
        updatedAt: new Date(),
      },
      create: {
        uniqueId,
        chainId: String(token.chainId),
        address: token.address.toLowerCase(),
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        tags: JSON.stringify(token.tags || []),
        popularity: token.popularity,
        coingeckoId: token.coingeckoId,
        isActive: true,
      },
    });
  }
  console.log('Tokens seeded.');

  // Create/update version
  await prisma.configVersion.upsert({
    where: { id: 'main' },
    update: {
      version: '1.0.0',
      chainsVersion: '1.0.0',
      tokensVersion: '1.0.0',
      chainsUpdatedAt: new Date(),
      tokensUpdatedAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      id: 'main',
      version: '1.0.0',
      chainsVersion: '1.0.0',
      tokensVersion: '1.0.0',
      chainsUpdatedAt: new Date(),
      tokensUpdatedAt: new Date(),
    },
  });

  console.log('Config version created.');
  console.log('Seeding complete!');
}

seedConfig()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
