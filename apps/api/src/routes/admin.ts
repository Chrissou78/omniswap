// apps/api/src/routes/admin.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { redis } from '../utils/redis';
import { GoPlusService } from '@omniswap/core';
import { requireAdmin } from '../middleware/auth';

export async function adminRoutes(fastify: FastifyInstance) {
  const goPlusService = new GoPlusService(redis);

  // Apply admin auth to all routes
  fastify.addHook('preHandler', requireAdmin);

  // ==================== DASHBOARD ====================
  
  fastify.get('/api/admin/stats', async (request, reply) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dayBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Current 24h stats
    const [volume24h, swaps24h, revenue24h, activeUsers24h] = await Promise.all([
      prisma.swap.aggregate({
        where: { createdAt: { gte: yesterday } },
        _sum: { volumeUsd: true },
      }),
      prisma.swap.count({
        where: { createdAt: { gte: yesterday } },
      }),
      prisma.swap.aggregate({
        where: { createdAt: { gte: yesterday } },
        _sum: { platformFeeUsd: true },
      }),
      prisma.swap.groupBy({
        by: ['userAddress'],
        where: { createdAt: { gte: yesterday } },
      }),
    ]);

    // Previous 24h stats for comparison
    const [prevVolume, prevSwaps, prevRevenue, prevUsers] = await Promise.all([
      prisma.swap.aggregate({
        where: { createdAt: { gte: dayBefore, lt: yesterday } },
        _sum: { volumeUsd: true },
      }),
      prisma.swap.count({
        where: { createdAt: { gte: dayBefore, lt: yesterday } },
      }),
      prisma.swap.aggregate({
        where: { createdAt: { gte: dayBefore, lt: yesterday } },
        _sum: { platformFeeUsd: true },
      }),
      prisma.swap.groupBy({
        by: ['userAddress'],
        where: { createdAt: { gte: dayBefore, lt: yesterday } },
      }),
    ]);

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return reply.send({
      volume24h: volume24h._sum.volumeUsd || 0,
      volumeChange: calculateChange(
        volume24h._sum.volumeUsd || 0,
        prevVolume._sum.volumeUsd || 0
      ),
      swaps24h,
      swapsChange: calculateChange(swaps24h, prevSwaps),
      revenue24h: revenue24h._sum.platformFeeUsd || 0,
      revenueChange: calculateChange(
        revenue24h._sum.platformFeeUsd || 0,
        prevRevenue._sum.platformFeeUsd || 0
      ),
      activeUsers24h: activeUsers24h.length,
      usersChange: calculateChange(activeUsers24h.length, prevUsers.length),
    });
  });

  // ==================== TENANTS ====================
  
  fastify.get('/api/admin/tenants', async (request, reply) => {
    const { search, status } = request.query as any;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'all') {
      where.status = status;
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        config: true,
        _count: { select: { swaps: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get 24h stats for each tenant
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const stats = await prisma.swap.aggregate({
          where: {
            tenantId: tenant.id,
            createdAt: { gte: yesterday },
          },
          _sum: { volumeUsd: true, platformFeeUsd: true },
          _count: true,
        });

        return {
          ...tenant,
          stats: {
            volume24h: stats._sum.volumeUsd || 0,
            swaps24h: stats._count,
            revenue24h: stats._sum.platformFeeUsd || 0,
          },
          branding: tenant.config?.branding || {},
        };
      })
    );

    return reply.send(tenantsWithStats);
  });

  fastify.post('/api/admin/tenants', async (request, reply) => {
    const { name, slug, domain, plan, adminEmail, primaryColor } = request.body as any;

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(400).send({ error: 'Slug already exists' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        domain,
        plan,
        status: 'pending',
        config: {
          create: {
            branding: {
              primaryColor,
            },
            fees: {
              onChainSwap: 0.004,
              crossChainSwap: 0.005,
              cexTrade: 0.01,
            },
          },
        },
        admins: {
          create: {
            email: adminEmail,
            role: 'owner',
          },
        },
      },
      include: { config: true },
    });

    // TODO: Send welcome email to admin

    return reply.status(201).send(tenant);
  });

  fastify.get('/api/admin/tenants/:id', async (request, reply) => {
    const { id } = request.params as any;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        config: true,
        admins: true,
        tokens: true,
        apiKeys: true,
      },
    });

    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }

    return reply.send(tenant);
  });

  fastify.patch('/api/admin/tenants/:id', async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    const updated = await prisma.tenant.update({
      where: { id },
      data,
    });

    return reply.send(updated);
  });

  fastify.patch('/api/admin/tenants/:id/branding', async (request, reply) => {
    const { id } = request.params as any;
    const branding = request.body;

    const updated = await prisma.tenantConfig.update({
      where: { tenantId: id },
      data: { branding },
    });

    return reply.send(updated);
  });

  fastify.patch('/api/admin/tenants/:id/fees', async (request, reply) => {
    const { id } = request.params as any;
    const fees = request.body;

    const updated = await prisma.tenantConfig.update({
      where: { tenantId: id },
      data: { fees },
    });

    return reply.send(updated);
  });

  fastify.patch('/api/admin/tenants/:id/status', async (request, reply) => {
    const { id } = request.params as any;
    const { status } = request.body as any;

    const updated = await prisma.tenant.update({
      where: { id },
      data: { status },
    });

    return reply.send(updated);
  });

  fastify.delete('/api/admin/tenants/:id', async (request, reply) => {
    const { id } = request.params as any;

    // Soft delete or check for active swaps
    const activeSwaps = await prisma.swap.count({
      where: {
        tenantId: id,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (activeSwaps > 0) {
      return reply.status(400).send({
        error: 'Cannot delete tenant with active swaps',
      });
    }

    await prisma.tenant.delete({ where: { id } });

    return reply.status(204).send();
  });

  // ==================== TOKENS ====================
  
  fastify.get('/api/admin/tokens', async (request, reply) => {
    const { search, chainId, status, limit = 100, offset = 0 } = request.query as any;

    const where: any = {};
    if (search) {
      where.OR = [
        { symbol: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (chainId && chainId !== 'all') {
      where.chainId = String(chainId);
    }
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'verified') {
      where.isVerified = true;
    } else if (status === 'unverified') {
      where.isVerified = false;
    } else if (status === 'risky') {
      where.audit = {
        path: ['riskLevel'],
        not: 'low',
      };
    }

    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.token.count({ where }),
    ]);

    // Get 24h stats for tokens
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tokensWithStats = await Promise.all(
      tokens.map(async (token) => {
        const stats = await prisma.swap.aggregate({
          where: {
            OR: [
              { fromTokenAddress: token.address },
              { toTokenAddress: token.address },
            ],
            createdAt: { gte: yesterday },
          },
          _sum: { volumeUsd: true },
          _count: true,
        });

        return {
          ...token,
          stats: {
            volume24h: stats._sum.volumeUsd || 0,
            swaps24h: stats._count,
          },
        };
      })
    );

    return reply.send({
      tokens: tokensWithStats,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  });

  fastify.post('/api/admin/tokens/validate', async (request, reply) => {
    const { chainId, address } = request.body as any;

    try {
      // Validate token exists on-chain
      const tokenInfo = await validateTokenOnChain(chainId, address);

      if (!tokenInfo) {
        return reply.send({
          isValid: false,
          error: 'Token not found on chain',
        });
      }

      // Get security audit from GoPlus
      const audit = await goPlusService.getAuditSummary(chainId, address);

      return reply.send({
        isValid: true,
        token: tokenInfo,
        audit,
      });
    } catch (error: any) {
      return reply.send({
        isValid: false,
        error: error.message || 'Validation failed',
      });
    }
  });

  fastify.post('/api/admin/tokens', async (request, reply) => {
    const { chainId, address, symbol, name, decimals, logoURI } = request.body as any;

    // Check if token already exists
    const existing = await prisma.token.findFirst({
      where: {
        chainId: String(chainId),
        address: address.toLowerCase(),
      },
    });

    if (existing) {
      return reply.status(400).send({ error: 'Token already exists' });
    }

    // Get audit data
    const audit = await goPlusService.getTokenSecurity(chainId, address);

    const token = await prisma.token.create({
      data: {
        chainId: String(chainId),
        address: address.toLowerCase(),
        symbol,
        name,
        decimals,
        logoURI,
        source: 'manual',
        isActive: true,
        isVerified: false,
        audit: audit ? {
          riskLevel: audit.riskLevel,
          riskScore: audit.riskScore,
          isHoneypot: audit.isHoneypot,
          buyTax: audit.buyTax,
          sellTax: audit.sellTax,
          lastAudit: new Date().toISOString(),
        } : null,
      },
    });

    return reply.status(201).send(token);
  });

  fastify.get('/api/admin/tokens/:chainId/:address', async (request, reply) => {
    const { chainId, address } = request.params as any;

    const token = await prisma.token.findFirst({
      where: {
        chainId: String(chainId),
        address: address.toLowerCase(),
      },
    });

    if (!token) {
      return reply.status(404).send({ error: 'Token not found' });
    }

    // Get full audit
    const audit = await goPlusService.getTokenSecurity(chainId, address);

    return reply.send({
      ...token,
      fullAudit: audit,
    });
  });

  fastify.patch('/api/admin/tokens/:id', async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    const updated = await prisma.token.update({
      where: { id },
      data,
    });

    return reply.send(updated);
  });

  fastify.delete('/api/admin/tokens/:id', async (request, reply) => {
    const { id } = request.params as any;

    await prisma.token.delete({ where: { id } });

    return reply.status(204).send();
  });

  // Token sync status
  fastify.get('/api/admin/tokens/sync/status', async (request, reply) => {
    const sources = ['1inch', 'jupiter', 'cetus', 'coingecko', 'mexc'];
    
    const statuses = await Promise.all(
      sources.map(async (source) => {
        const status = await redis.getJSON<{
          lastSync: string;
          status: string;
          error?: string;
        }>(`token-sync:${source}:status`);
        
        const count = await prisma.token.count({ where: { source } });
        
        return {
          source,
          lastSync: status?.lastSync || null,
          tokenCount: count,
          status: status?.status || 'unknown',
          error: status?.error,
        };
      })
    );

    return reply.send(statuses);
  });

  fastify.post('/api/admin/tokens/sync/:source', async (request, reply) => {
    const { source } = request.params as any;

    // Set status to running
    await redis.setJSON(`token-sync:${source}:status`, {
      status: 'running',
      lastSync: new Date().toISOString(),
    });

    // Queue sync job (would use BullMQ in production)
    // For now, trigger sync directly in background
    syncTokensFromSource(source).catch((error) => {
      redis.setJSON(`token-sync:${source}:status`, {
        status: 'failed',
        lastSync: new Date().toISOString(),
        error: error.message,
      });
    });

    return reply.send({ message: `Sync started for ${source}` });
  });

  // ==================== ANALYTICS ====================
  
  fastify.get('/api/admin/analytics/volume', async (request, reply) => {
    const { timeframe = '7d' } = request.query as any;

    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get volume by day and chain
    const volumeData = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN from_chain_id = '1' THEN volume_usd ELSE 0 END) as ethereum,
        SUM(CASE WHEN from_chain_id = '137' THEN volume_usd ELSE 0 END) as polygon,
        SUM(CASE WHEN from_chain_id = '42161' THEN volume_usd ELSE 0 END) as arbitrum,
        SUM(CASE WHEN from_chain_id = 'solana-mainnet' THEN volume_usd ELSE 0 END) as solana,
        SUM(CASE WHEN from_chain_id = 'sui-mainnet' THEN volume_usd ELSE 0 END) as sui,
        SUM(CASE WHEN from_chain_id != to_chain_id THEN volume_usd ELSE 0 END) as "crossChain",
        SUM(CASE WHEN route_type = 'cex' THEN volume_usd ELSE 0 END) as cex,
        SUM(volume_usd) as total
      FROM swaps
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return reply.send(volumeData);
  });

  fastify.get('/api/admin/analytics/revenue', async (request, reply) => {
    const { timeframe = '7d' } = request.query as any;

    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const revenueData = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN from_chain_id = to_chain_id AND route_type != 'cex' THEN platform_fee_usd ELSE 0 END) as "onChainFees",
        SUM(CASE WHEN from_chain_id != to_chain_id THEN platform_fee_usd ELSE 0 END) as "crossChainFees",
        SUM(CASE WHEN route_type = 'cex' THEN platform_fee_usd ELSE 0 END) as "cexFees",
        SUM(platform_fee_usd) as total
      FROM swaps
      WHERE created_at >= ${startDate}
        AND status = 'COMPLETED'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return reply.send(revenueData);
  });

  fastify.get('/api/admin/analytics/users', async (request, reply) => {
    const { timeframe = '7d' } = request.query as any;

    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const userData = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT user_address) as "uniqueUsers",
        COUNT(*) as "totalSwaps",
        COUNT(DISTINCT CASE WHEN is_new_user = true THEN user_address END) as "newUsers"
      FROM swaps
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return reply.send(userData);
  });

  fastify.get('/api/admin/analytics/tokens', async (request, reply) => {
    const { timeframe = '7d', limit = 20 } = request.query as any;

    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const topTokens = await prisma.$queryRaw<any[]>`
      SELECT 
        t.symbol,
        t.name,
        t.chain_id as "chainId",
        t.logo_uri as "logoURI",
        COUNT(*) as swaps,
        SUM(s.volume_usd) as volume
      FROM swaps s
      JOIN tokens t ON (s.from_token_address = t.address OR s.to_token_address = t.address)
      WHERE s.created_at >= ${startDate}
      GROUP BY t.symbol, t.name, t.chain_id, t.logo_uri
      ORDER BY volume DESC
      LIMIT ${parseInt(limit)}
    `;

    return reply.send(topTokens);
  });

  fastify.get('/api/admin/analytics/routes', async (request, reply) => {
    const { timeframe = '7d' } = request.query as any;

    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const routeStats = await prisma.$queryRaw<any[]>`
      SELECT 
        route_type as "routeType",
        COUNT(*) as count,
        SUM(volume_usd) as volume,
        AVG(execution_time_ms) as "avgExecutionTime",
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)::float / COUNT(*)::float as "successRate"
      FROM swaps
      WHERE created_at >= ${startDate}
      GROUP BY route_type
      ORDER BY volume DESC
    `;

    return reply.send(routeStats);
  });

  // ==================== SWAPS ====================
  
  fastify.get('/api/admin/swaps', async (request, reply) => {
    const { 
      status, 
      chainId, 
      tenantId, 
      userAddress,
      fromDate,
      toDate,
      limit = 50, 
      offset = 0 
    } = request.query as any;

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    if (chainId) {
      where.OR = [
        { fromChainId: String(chainId) },
        { toChainId: String(chainId) },
      ];
    }
    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (userAddress) {
      where.userAddress = userAddress.toLowerCase();
    }
    if (fromDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(fromDate) };
    }
    if (toDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(toDate) };
    }

    const [swaps, total] = await Promise.all([
      prisma.swap.findMany({
        where,
        include: {
          steps: true,
          tenant: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.swap.count({ where }),
    ]);

    return reply.send({
      swaps,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  });

  fastify.get('/api/admin/swaps/recent', async (request, reply) => {
    const { limit = 10 } = request.query as any;

    const swaps = await prisma.swap.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      select: {
        id: true,
        status: true,
        fromChainId: true,
        toChainId: true,
        fromToken: true,
        toToken: true,
        volumeUsd: true,
        createdAt: true,
      },
    });

    return reply.send(swaps);
  });

  fastify.get('/api/admin/swaps/:id', async (request, reply) => {
    const { id } = request.params as any;

    const swap = await prisma.swap.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepIndex: 'asc' },
        },
        tenant: true,
      },
    });

    if (!swap) {
      return reply.status(404).send({ error: 'Swap not found' });
    }

    return reply.send(swap);
  });

  fastify.post('/api/admin/swaps/:id/retry', async (request, reply) => {
    const { id } = request.params as any;

    const swap = await prisma.swap.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!swap) {
      return reply.status(404).send({ error: 'Swap not found' });
    }

    if (swap.status !== 'FAILED') {
      return reply.status(400).send({ error: 'Can only retry failed swaps' });
    }

    // Find the failed step
    const failedStep = swap.steps.find((s) => s.status === 'FAILED');
    if (!failedStep) {
      return reply.status(400).send({ error: 'No failed step found' });
    }

    // Queue retry
    // await swapQueue.add('retry-swap', { swapId: id, stepIndex: failedStep.stepIndex });

    await prisma.swap.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    return reply.send({ message: 'Retry queued' });
  });

  fastify.post('/api/admin/swaps/:id/refund', async (request, reply) => {
    const { id } = request.params as any;
    const { reason } = request.body as any;

    const swap = await prisma.swap.findUnique({ where: { id } });

    if (!swap) {
      return reply.status(404).send({ error: 'Swap not found' });
    }

    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        swapId: id,
        amount: swap.inputAmount,
        token: swap.fromToken,
        chainId: swap.fromChainId,
        reason,
        status: 'PENDING',
      },
    });

    // Queue refund processing
    // await refundQueue.add('process-refund', { refundId: refund.id });

    return reply.send(refund);
  });

  // ==================== SETTINGS ====================
  
  fastify.get('/api/admin/settings', async (request, reply) => {
    const settings = await prisma.platformSettings.findFirst();
    return reply.send(settings || getDefaultSettings());
  });

  fastify.patch('/api/admin/settings', async (request, reply) => {
    const data = request.body as any;

    const settings = await prisma.platformSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });

    // Clear settings cache
    await redis.del('platform-settings');

    return reply.send(settings);
  });

  fastify.get('/api/admin/settings/fees', async (request, reply) => {
    const settings = await prisma.platformSettings.findFirst();
    
    return reply.send({
      onChainSwap: settings?.fees?.onChainSwap || 0.004,
      crossChainSwap: settings?.fees?.crossChainSwap || 0.005,
      cexTrade: settings?.fees?.cexTrade || 0.01,
      minFeeUsd: settings?.fees?.minFeeUsd || 0,
      maxFeeUsd: settings?.fees?.maxFeeUsd || 1000,
    });
  });

  fastify.patch('/api/admin/settings/fees', async (request, reply) => {
    const fees = request.body as any;

    const settings = await prisma.platformSettings.upsert({
      where: { id: 'default' },
      update: { fees },
      create: { id: 'default', fees },
    });

    await redis.del('platform-settings');

    return reply.send(settings.fees);
  });

  // ==================== API KEYS ====================
  
  fastify.get('/api/admin/api-keys', async (request, reply) => {
    const apiKeys = await prisma.apiKey.findMany({
      include: {
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mask the actual keys
    const maskedKeys = apiKeys.map((key) => ({
      ...key,
      key: `${key.key.slice(0, 8)}...${key.key.slice(-4)}`,
    }));

    return reply.send(maskedKeys);
  });

  fastify.post('/api/admin/api-keys', async (request, reply) => {
    const { tenantId, name, permissions, rateLimit } = request.body as any;

    // Generate API key
    const key = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId,
        name,
        key,
        permissions: permissions || ['read', 'swap'],
        rateLimit: rateLimit || 1000,
        isActive: true,
      },
    });

    // Return full key only on creation
    return reply.status(201).send(apiKey);
  });

  fastify.patch('/api/admin/api-keys/:id', async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;

    const updated = await prisma.apiKey.update({
      where: { id },
      data,
    });

    return reply.send({
      ...updated,
      key: `${updated.key.slice(0, 8)}...${updated.key.slice(-4)}`,
    });
  });

  fastify.delete('/api/admin/api-keys/:id', async (request, reply) => {
    const { id } = request.params as any;

    await prisma.apiKey.delete({ where: { id } });

    return reply.status(204).send();
  });

  fastify.post('/api/admin/api-keys/:id/rotate', async (request, reply) => {
    const { id } = request.params as any;

    const newKey = generateApiKey();

    const updated = await prisma.apiKey.update({
      where: { id },
      data: { key: newKey },
    });

    // Return full new key
    return reply.send(updated);
  });

  // ==================== SYSTEM HEALTH ====================
  
  fastify.get('/api/admin/health', async (request, reply) => {
    const checks = await Promise.allSettled([
      // Database
      prisma.$queryRaw`SELECT 1`,
      // Redis
      redis.ping(),
      // External APIs
      checkExternalApi('https://api.1inch.dev/healthcheck'),
      checkExternalApi('https://quote-api.jup.ag/v6/health'),
      checkExternalApi('https://li.quest/v1/health'),
    ]);

    const health = {
      database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      oneInch: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      jupiter: checks[3].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      lifi: checks[4].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };

    const allHealthy = Object.values(health)
      .filter((v) => typeof v === 'string' && v !== health.timestamp)
      .every((v) => v === 'healthy');

    return reply.status(allHealthy ? 200 : 503).send(health);
  });

  fastify.get('/api/admin/metrics', async (request, reply) => {
    const [
      totalSwaps,
      totalVolume,
      totalRevenue,
      totalUsers,
      totalTenants,
      activeSwaps,
    ] = await Promise.all([
      prisma.swap.count(),
      prisma.swap.aggregate({ _sum: { volumeUsd: true } }),
      prisma.swap.aggregate({ _sum: { platformFeeUsd: true } }),
      prisma.swap.groupBy({ by: ['userAddress'] }).then((r) => r.length),
      prisma.tenant.count(),
      prisma.swap.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
    ]);

    return reply.send({
      totalSwaps,
      totalVolume: totalVolume._sum.volumeUsd || 0,
      totalRevenue: totalRevenue._sum.platformFeeUsd || 0,
      totalUsers,
      totalTenants,
      activeSwaps,
    });
  });
}

// ==================== HELPER FUNCTIONS ====================

async function validateTokenOnChain(
  chainId: number | string,
  address: string
): Promise<{ symbol: string; name: string; decimals: number; logoURI?: string } | null> {
  // Implementation would vary by chain
  // For EVM chains, use ethers to call ERC20 methods
  // For Solana, use @solana/web3.js
  // For Sui, use @mysten/sui
  
  // Placeholder implementation
  try {
    if (typeof chainId === 'number' || !isNaN(Number(chainId))) {
      // EVM chain
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(getRpcUrl(chainId));
      const contract = new ethers.Contract(
        address,
        ['function symbol() view returns (string)', 'function name() view returns (string)', 'function decimals() view returns (uint8)'],
        provider
      );

      const [symbol, name, decimals] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals(),
      ]);

      return { symbol, name, decimals: Number(decimals) };
    }
    
    // Non-EVM chains would have their own implementation
    return null;
  } catch (error) {
    return null;
  }
}

async function syncTokensFromSource(source: string): Promise<void> {
  // Implementation for each source
  const syncFunctions: Record<string, () => Promise<void>> = {
    '1inch': sync1inchTokens,
    jupiter: syncJupiterTokens,
    cetus: syncCetusTokens,
    coingecko: syncCoingeckoTokens,
    mexc: syncMexcTokens,
  };

  const syncFn = syncFunctions[source];
  if (!syncFn) {
    throw new Error(`Unknown source: ${source}`);
  }

  await syncFn();

  await redis.setJSON(`token-sync:${source}:status`, {
    status: 'success',
    lastSync: new Date().toISOString(),
  });
}

async function sync1inchTokens(): Promise<void> {
  const chains = [1, 56, 137, 42161, 10, 8453, 43114];
  
  for (const chainId of chains) {
    const response = await fetch(`https://api.1inch.dev/token/v1.2/${chainId}`);
    const data = await response.json();

    for (const [address, token] of Object.entries(data.tokens || {})) {
      const t = token as any;
      await prisma.token.upsert({
        where: {
          chainId_address: {
            chainId: String(chainId),
            address: address.toLowerCase(),
          },
        },
        update: {
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          logoURI: t.logoURI,
          updatedAt: new Date(),
        },
        create: {
          chainId: String(chainId),
          address: address.toLowerCase(),
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          logoURI: t.logoURI,
          source: '1inch',
          isActive: true,
          isVerified: true,
        },
      });
    }
  }
}

async function syncJupiterTokens(): Promise<void> {
  const response = await fetch('https://token.jup.ag/all');
  const tokens = await response.json();

  for (const token of tokens) {
    await prisma.token.upsert({
      where: {
        chainId_address: {
          chainId: 'solana-mainnet',
          address: token.address,
        },
      },
      update: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        updatedAt: new Date(),
      },
      create: {
        chainId: 'solana-mainnet',
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        source: 'jupiter',
        isActive: true,
        isVerified: token.tags?.includes('verified') || false,
      },
    });
  }
}

async function syncCetusTokens(): Promise<void> {
  const response = await fetch('https://api-sui.cetus.zone/v2/sui/tokens');
  const data = await response.json();

  for (const token of data.data || []) {
    await prisma.token.upsert({
      where: {
        chainId_address: {
          chainId: 'sui-mainnet',
          address: token.address,
        },
      },
      update: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logo_url,
        updatedAt: new Date(),
      },
      create: {
        chainId: 'sui-mainnet',
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logo_url,
        source: 'cetus',
        isActive: true,
        isVerified: token.is_verified || false,
      },
    });
  }
}

async function syncCoingeckoTokens(): Promise<void> {
  // CoinGecko token list for metadata enrichment
  const response = await fetch(
    'https://api.coingecko.com/api/v3/coins/list?include_platform=true'
  );
  const coins = await response.json();

  // Update existing tokens with CoinGecko IDs
  for (const coin of coins) {
    if (coin.platforms) {
      for (const [platform, address] of Object.entries(coin.platforms)) {
        if (address) {
          const chainId = getChainIdFromPlatform(platform);
          if (chainId) {
            await prisma.token.updateMany({
              where: {
                chainId,
                address: (address as string).toLowerCase(),
              },
              data: {
                coingeckoId: coin.id,
              },
            });
          }
        }
      }
    }
  }
}

async function syncMexcTokens(): Promise<void> {
  const response = await fetch('https://api.mexc.com/api/v3/exchangeInfo');
  const data = await response.json();

  for (const symbol of data.symbols || []) {
    // MEXC tokens are mapped to chain tokens separately
    await prisma.cexToken.upsert({
      where: {
        exchange_symbol: {
          exchange: 'mexc',
          symbol: symbol.baseAsset,
        },
      },
      update: {
        isActive: symbol.status === 'ENABLED',
        updatedAt: new Date(),
      },
      create: {
        exchange: 'mexc',
        symbol: symbol.baseAsset,
        name: symbol.baseAsset,
        isActive: symbol.status === 'ENABLED',
      },
    });
  }
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'omni_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function getRpcUrl(chainId: number | string): string {
  const rpcs: Record<number | string, string> = {
    1: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    56: process.env.BSC_RPC_URL || 'https://bsc.llamarpc.com',
    137: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
    42161: process.env.ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com',
    10: process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com',
    8453: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
    43114: process.env.AVALANCHE_RPC_URL || 'https://avalanche.llamarpc.com',
  };
  return rpcs[chainId] || '';
}

function getChainIdFromPlatform(platform: string): string | null {
  const mapping: Record<string, string> = {
    ethereum: '1',
    'binance-smart-chain': '56',
    'polygon-pos': '137',
    'arbitrum-one': '42161',
    'optimistic-ethereum': '10',
    base: '8453',
    'avalanche-c-chain': '43114',
    solana: 'solana-mainnet',
    sui: 'sui-mainnet',
  };
  return mapping[platform] || null;
}

async function checkExternalApi(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

function getDefaultSettings() {
  return {
    fees: {
      onChainSwap: 0.004,
      crossChainSwap: 0.005,
      cexTrade: 0.01,
      minFeeUsd: 0,
      maxFeeUsd: 1000,
    },
    features: {
      cexEnabled: true,
      crossChainEnabled: true,
      limitOrdersEnabled: false,
    },
    supportedChains: [1, 56, 137, 42161, 10, 8453, 43114, 'solana-mainnet', 'sui-mainnet'],
  };
}
