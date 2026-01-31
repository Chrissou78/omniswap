// apps/api/src/routes/tokens.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { GoPlusService } from '@omniswap/core';
import { z } from 'zod';

const goPlusService = new GoPlusService(redis);

// Validation schemas
const getTokenParamsSchema = z.object({
  chainId: z.string(),
  address: z.string(),
});

const getTokensQuerySchema = z.object({
  chainId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  favorites: z.enum(['true', 'false']).optional(),
  recent: z.enum(['true', 'false']).optional(),
});

export async function tokenRoutes(fastify: FastifyInstance) {
  // Get token list
  fastify.get('/tokens', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = getTokensQuerySchema.parse(request.query);
    const userId = (request as any).user?.id;
    const tenantId = (request as any).tenantId;

    const where: any = {
      isActive: true,
      ...(tenantId && {
        OR: [
          { tenantId: null },
          { tenantId },
        ],
      }),
    };

    if (query.chainId) {
      where.chainId = query.chainId;
    }

    if (query.search) {
      where.OR = [
        { symbol: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { address: { equals: query.search.toLowerCase() } },
      ];
    }

    if (query.favorites === 'true' && userId) {
      const favoriteTokens = await prisma.userFavoriteToken.findMany({
        where: { userId },
        select: { tokenId: true },
      });
      where.id = { in: favoriteTokens.map((f) => f.tokenId) };
    }

    if (query.recent === 'true' && userId) {
      const recentSwaps = await prisma.swap.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          fromTokenId: true,
          toTokenId: true,
        },
      });
      const tokenIds = [...new Set([
        ...recentSwaps.map((s) => s.fromTokenId),
        ...recentSwaps.map((s) => s.toTokenId),
      ])].filter(Boolean);
      where.id = { in: tokenIds };
    }

    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        orderBy: [
          { isVerified: 'desc' },
          { volume24h: 'desc' },
        ],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.token.count({ where }),
    ]);

    return {
      tokens,
      total,
      hasMore: query.offset + tokens.length < total,
    };
  });

  // Get popular tokens
  fastify.get('/tokens/popular', async (request: FastifyRequest) => {
    const query = z.object({
      chainId: z.string(),
      limit: z.coerce.number().min(1).max(20).default(8),
    }).parse(request.query);

    const tokens = await prisma.token.findMany({
      where: {
        chainId: query.chainId,
        isActive: true,
        isVerified: true,
      },
      orderBy: { volume24h: 'desc' },
      take: query.limit,
    });

    return { tokens };
  });

  // Get single token
  fastify.get('/tokens/:chainId/:address', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = getTokenParamsSchema.parse(request.params);

    let token = await prisma.token.findFirst({
      where: {
        chainId: params.chainId,
        address: params.address.toLowerCase(),
      },
    });

    if (!token) {
      // Try to fetch from external sources
      const { fetchTokenMetadata } = await import('@omniswap/core');
      const metadata = await fetchTokenMetadata(params.chainId, params.address);
      
      if (metadata) {
        token = await prisma.token.create({
          data: {
            chainId: params.chainId,
            address: params.address.toLowerCase(),
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            logoURI: metadata.logoURI,
            isVerified: false,
            isActive: true,
          },
        });
      }
    }

    if (!token) {
      return reply.status(404).send({ error: 'Token not found' });
    }

    return { token };
  });

  // Get token audit
  fastify.get(
    '/tokens/:chainId/:address/audit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = getTokenParamsSchema.parse(request.params);

      try {
        const audit = await goPlusService.getTokenSecurity(
          params.chainId,
          params.address
        );

        if (!audit) {
          return reply.status(404).send({
            error: 'Audit not available',
            message: 'Unable to fetch security audit for this token',
          });
        }

        // Store audit in database for historical tracking
        await prisma.tokenAudit.upsert({
          where: {
            chainId_address: {
              chainId: params.chainId,
              address: params.address.toLowerCase(),
            },
          },
          create: {
            chainId: params.chainId,
            address: params.address.toLowerCase(),
            riskLevel: audit.riskLevel,
            riskScore: audit.riskScore,
            data: audit as any,
            lastUpdated: new Date(),
          },
          update: {
            riskLevel: audit.riskLevel,
            riskScore: audit.riskScore,
            data: audit as any,
            lastUpdated: new Date(),
          },
        });

        return { audit };
      } catch (error) {
        fastify.log.error('Failed to fetch token audit', error);
        return reply.status(500).send({
          error: 'Audit fetch failed',
          message: 'An error occurred while fetching the security audit',
        });
      }
    }
  );

  // Refresh token audit (bypass cache)
  fastify.post(
    '/tokens/:chainId/:address/audit/refresh',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = getTokenParamsSchema.parse(request.params);

      // Clear cache
      await goPlusService.clearCache(params.chainId, params.address);

      // Fetch fresh data
      const audit = await goPlusService.getTokenSecurity(
        params.chainId,
        params.address
      );

      if (!audit) {
        return reply.status(404).send({
          error: 'Audit not available',
        });
      }

      return { audit };
    }
  );

  // Batch get token audits
  fastify.post(
    '/tokens/audit/batch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = z.object({
        chainId: z.string(),
        addresses: z.array(z.string()).max(100),
      }).parse(request.body);

      const audits = await goPlusService.batchGetTokenSecurity(
        body.chainId,
        body.addresses
      );

      return {
        audits: Object.fromEntries(audits),
      };
    }
  );

  // Toggle favorite token
  fastify.post(
    '/tokens/:chainId/:address/favorite',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = getTokenParamsSchema.parse(request.params);
      const userId = (request as any).user.id;

      const token = await prisma.token.findFirst({
        where: {
          chainId: params.chainId,
          address: params.address.toLowerCase(),
        },
      });

      if (!token) {
        return reply.status(404).send({ error: 'Token not found' });
      }

      const existing = await prisma.userFavoriteToken.findFirst({
        where: {
          userId,
          tokenId: token.id,
        },
      });

      if (existing) {
        await prisma.userFavoriteToken.delete({
          where: { id: existing.id },
        });
        return { isFavorite: false };
      } else {
        await prisma.userFavoriteToken.create({
          data: {
            userId,
            tokenId: token.id,
          },
        });
        return { isFavorite: true };
      }
    }
  );
}
