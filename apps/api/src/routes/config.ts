// apps/api/src/routes/config.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

const router = Router();
const prisma = new PrismaClient();

// Redis client (optional - for caching)
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
} catch (e) {
  console.warn('Redis not available, using in-memory cache');
}

// In-memory cache fallback
const memoryCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache helpers
async function getFromCache<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Redis get error:', e);
    }
  }
  
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

async function setToCache(key: string, data: any, ttl: number = 300): Promise<void> {
  if (redis) {
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
    } catch (e) {
      console.error('Redis set error:', e);
    }
  }
  memoryCache.set(key, { data, timestamp: Date.now() });
}

// ============ GET /api/v1/config/chains ============
router.get('/chains', async (req: Request, res: Response) => {
  try {
    // Check cache first
    const cacheKey = 'config:chains';
    const cached = await getFromCache<any>(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // Fetch from database
    const chains = await prisma.chain.findMany({
      where: { isActive: true },
      orderBy: { popularity: 'desc' },
    });

    // Get version info
    const versionInfo = await prisma.configVersion.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const response = {
      chains: chains.map((chain) => ({
        id: chain.chainId,
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
      })),
      version: versionInfo?.chainsVersion || '1.0.0',
      lastUpdated: versionInfo?.chainsUpdatedAt?.toISOString() || new Date().toISOString(),
    };

    // Cache the response
    await setToCache(cacheKey, response, 300);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching chains:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch chains',
    });
  }
});

// ============ GET /api/v1/config/tokens ============
router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const { chainId } = req.query;
    
    // Check cache first
    const cacheKey = chainId ? `config:tokens:${chainId}` : 'config:tokens:all';
    const cached = await getFromCache<any>(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // Build query
    const where: any = { isActive: true };
    if (chainId) {
      where.chainId = String(chainId);
    }

    // Fetch from database
    const tokens = await prisma.token.findMany({
      where,
      orderBy: { popularity: 'desc' },
      take: chainId ? undefined : 1000, // Limit if fetching all
    });

    // Get version info
    const versionInfo = await prisma.configVersion.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const response = {
      tokens: tokens.map((token) => ({
        chainId: token.chainId,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        tags: token.tags ? JSON.parse(token.tags) : [],
        popularity: token.popularity,
        coingeckoId: token.coingeckoId,
      })),
      chainId: chainId || undefined,
      version: versionInfo?.tokensVersion || '1.0.0',
      lastUpdated: versionInfo?.tokensUpdatedAt?.toISOString() || new Date().toISOString(),
    };

    // Cache the response
    await setToCache(cacheKey, response, 300);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tokens',
    });
  }
});

// ============ GET /api/v1/config/tokens/search ============
router.get('/tokens/search', async (req: Request, res: Response) => {
  try {
    const { q, chainId, limit = '50' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }

    const searchQuery = q.toLowerCase().trim();
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);

    // Build where clause
    const where: any = {
      isActive: true,
      OR: [
        { symbol: { contains: searchQuery, mode: 'insensitive' } },
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { address: { contains: searchQuery, mode: 'insensitive' } },
      ],
    };

    if (chainId) {
      where.chainId = String(chainId);
    }

    const tokens = await prisma.token.findMany({
      where,
      orderBy: { popularity: 'desc' },
      take: limitNum,
    });

    return res.json({
      tokens: tokens.map((token) => ({
        chainId: token.chainId,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        tags: token.tags ? JSON.parse(token.tags) : [],
        popularity: token.popularity,
      })),
      query: q,
      chainId: chainId || undefined,
    });
  } catch (error) {
    console.error('Error searching tokens:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search tokens',
    });
  }
});

// ============ GET /api/v1/config/version ============
router.get('/version', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'config:version';
    const cached = await getFromCache<any>(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const versionInfo = await prisma.configVersion.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const response = {
      version: versionInfo?.version || '1.0.0',
      chains: versionInfo?.chainsUpdatedAt?.toISOString() || '2026-01-24T00:00:00Z',
      tokens: versionInfo?.tokensUpdatedAt?.toISOString() || '2026-01-24T00:00:00Z',
    };

    await setToCache(cacheKey, response, 60); // Cache for 1 minute

    return res.json(response);
  } catch (error) {
    console.error('Error fetching version:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch version',
    });
  }
});

// ============ POST /api/v1/config/sync (Admin only) ============
router.post('/sync', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication/authorization check
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { chains, tokens } = req.body;

    // Sync chains
    if (chains && Array.isArray(chains)) {
      for (const chain of chains) {
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
    }

    // Sync tokens
    if (tokens && Array.isArray(tokens)) {
      for (const token of tokens) {
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
    }

    // Update version
    await prisma.configVersion.upsert({
      where: { id: 'main' },
      update: {
        version: `1.0.${Date.now()}`,
        chainsVersion: chains ? `1.0.${Date.now()}` : undefined,
        tokensVersion: tokens ? `1.0.${Date.now()}` : undefined,
        chainsUpdatedAt: chains ? new Date() : undefined,
        tokensUpdatedAt: tokens ? new Date() : undefined,
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

    // Clear cache
    if (redis) {
      await redis.del('config:chains');
      await redis.del('config:tokens:all');
      await redis.del('config:version');
      // Clear chain-specific token caches
      const keys = await redis.keys('config:tokens:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    memoryCache.clear();

    return res.json({
      success: true,
      message: 'Config synced successfully',
      synced: {
        chains: chains?.length || 0,
        tokens: tokens?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error syncing config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync config',
    });
  }
});

export default router;