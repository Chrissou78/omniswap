// apps/api/src/routes/quotes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { QuoteRequest } from '@omniswap/types';
import { QuoteService } from '@omniswap/core';
import { z } from 'zod';

// Request validation schema
const quoteRequestSchema = z.object({
  inputToken: z.object({
    chainId: z.string(),
    address: z.string(),
  }),
  outputToken: z.object({
    chainId: z.string(),
    address: z.string(),
  }),
  inputAmount: z.string().regex(/^\d+$/),
  slippage: z.number().min(0.01).max(50).optional(),
  userAddress: z.string().optional(),
  preferredRouteType: z.enum(['BEST_RETURN', 'FASTEST', 'CHEAPEST']).optional(),
  excludeProtocols: z.array(z.string()).optional(),
  excludeBridges: z.array(z.string()).optional(),
  enableCex: z.boolean().optional(),
});

export async function quoteRoutes(fastify: FastifyInstance) {
  const quoteService = fastify.quoteService as QuoteService;

  /**
   * POST /api/v1/quote
   * Get swap quotes
   */
  fastify.post('/', {
    schema: {
      description: 'Get swap quotes for token exchange',
      tags: ['Quote'],
      body: {
        type: 'object',
        required: ['inputToken', 'outputToken', 'inputAmount'],
        properties: {
          inputToken: {
            type: 'object',
            properties: {
              chainId: { type: 'string' },
              address: { type: 'string' },
            },
          },
          outputToken: {
            type: 'object',
            properties: {
              chainId: { type: 'string' },
              address: { type: 'string' },
            },
          },
          inputAmount: { type: 'string' },
          slippage: { type: 'number' },
          userAddress: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: QuoteRequest }>,
      reply: FastifyReply
    ) => {
      try {
        // Validate request
        const validatedBody = quoteRequestSchema.parse(request.body);

        // Get tenant fees
        const tenantFees = request.tenant?.fees;

        // Check if CEX routing is enabled for tenant
        const enableCex = validatedBody.enableCex !== false && 
          request.tenant?.features?.features?.cexRouting;

        // Get quote
        const quote = await quoteService.getQuote(
          {
            ...validatedBody,
            enableCex,
          },
          tenantFees
        );

        return reply.status(200).send({
          success: true,
          data: quote,
          meta: {
            requestId: request.id,
            timestamp: Date.now(),
            version: '1.0.0',
            processingTime: quote.processingTime,
          },
        });
      } catch (error: any) {
        request.log.error(error, 'Quote request failed');

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: error.errors,
            },
          });
        }

        return reply.status(500).send({
          success: false,
          error: {
            code: 'QUOTE_ERROR',
            message: error.message || 'Failed to get quote',
          },
        });
      }
    },
  });

  /**
   * GET /api/v1/quote/:quoteId
   * Get a previously fetched quote by ID
   */
  fastify.get('/:quoteId', {
    schema: {
      description: 'Get a quote by ID',
      tags: ['Quote'],
      params: {
        type: 'object',
        properties: {
          quoteId: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { quoteId: string } }>,
      reply: FastifyReply
    ) => {
      const { quoteId } = request.params;
      
      const quote = quoteService.getQuoteById(quoteId);
      
      if (!quote) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'QUOTE_NOT_FOUND',
            message: 'Quote not found or expired',
          },
        });
      }

      // Check if quote is expired
      if (quote.expiresAt < Date.now()) {
        return reply.status(410).send({
          success: false,
          error: {
            code: 'QUOTE_EXPIRED',
            message: 'Quote has expired',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: quote,
        meta: {
          requestId: request.id,
          timestamp: Date.now(),
          version: '1.0.0',
        },
      });
    },
  });

  /**
   * GET /api/v1/quote/routes
   * Get all possible routes without full quote
   */
  fastify.get('/routes', {
    schema: {
      description: 'Get possible routes for a swap',
      tags: ['Quote'],
      querystring: {
        type: 'object',
        required: ['fromChain', 'toChain', 'fromToken', 'toToken'],
        properties: {
          fromChain: { type: 'string' },
          toChain: { type: 'string' },
          fromToken: { type: 'string' },
          toToken: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          fromChain: string;
          toChain: string;
          fromToken: string;
          toToken: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { fromChain, toChain, fromToken, toToken } = request.query;

      // Determine available protocols for this route
      const isSameChain = fromChain === toChain;
      const protocols: string[] = [];

      if (isSameChain) {
        if (['ethereum', 'arbitrum', 'optimism', 'polygon', 'bsc', 'base', 'avalanche'].includes(fromChain)) {
          protocols.push('1inch');
        }
        if (fromChain === 'solana') {
          protocols.push('Jupiter');
        }
        if (fromChain === 'sui') {
          protocols.push('Cetus');
        }
      }

      // Cross-chain always uses Li.Fi
      if (!isSameChain) {
        protocols.push('Li.Fi');
      }

      // CEX routing if enabled
      if (request.tenant?.features?.features?.cexRouting) {
        protocols.push('MEXC');
      }

      return reply.status(200).send({
        success: true,
        data: {
          fromChain,
          toChain,
          availableProtocols: protocols,
          isCrossChain: !isSameChain,
          estimatedTime: isSameChain ? '< 1 min' : '2-10 min',
        },
        meta: {
          requestId: request.id,
          timestamp: Date.now(),
          version: '1.0.0',
        },
      });
    },
  });

  /**
   * POST /api/v1/quote/refresh
   * Refresh an existing quote
   */
  fastify.post('/refresh/:quoteId', {
    schema: {
      description: 'Refresh an existing quote with latest prices',
      tags: ['Quote'],
      params: {
        type: 'object',
        properties: {
          quoteId: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { quoteId: string } }>,
      reply: FastifyReply
    ) => {
      const { quoteId } = request.params;
      
      const existingQuote = quoteService.getQuoteById(quoteId);
      
      if (!existingQuote) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'QUOTE_NOT_FOUND',
            message: 'Quote not found',
          },
        });
      }

      // Get fresh quote using same parameters
      const freshQuote = await quoteService.getQuote(
        existingQuote.request,
        request.tenant?.fees
      );

      return reply.status(200).send({
        success: true,
        data: freshQuote,
        meta: {
          requestId: request.id,
          timestamp: Date.now(),
          version: '1.0.0',
          previousQuoteId: quoteId,
        },
      });
    },
  });
}
