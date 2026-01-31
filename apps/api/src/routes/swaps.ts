// apps/api/src/routes/swaps.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SwapService, CreateSwapParams, ExecuteStepParams } from '@omniswap/core';

// Validation schemas
const createSwapSchema = z.object({
  quoteId: z.string().uuid(),
  routeId: z.string(),
  userAddress: z.string(),
  cexCredentials: z.object({
    apiKey: z.string(),
    secretKey: z.string(),
  }).optional(),
});

const executeStepSchema = z.object({
  signedTransaction: z.string(),
});

export async function swapRoutes(fastify: FastifyInstance) {
  const swapService = fastify.swapService as SwapService;

  /**
   * POST /api/v1/swap
   * Create a new swap
   */
  fastify.post('/', {
    schema: {
      description: 'Create a new swap from a quote',
      tags: ['Swap'],
      body: {
        type: 'object',
        required: ['quoteId', 'routeId', 'userAddress'],
        properties: {
          quoteId: { type: 'string' },
          routeId: { type: 'string' },
          userAddress: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: CreateSwapParams }>,
      reply: FastifyReply
    ) => {
      try {
        const validated = createSwapSchema.parse(request.body);

        const swap = await swapService.createSwap({
          ...validated,
          tenantId: request.tenantId,
        });

        return reply.status(201).send({
          success: true,
          data: swap,
          meta: {
            requestId: request.id,
            timestamp: Date.now(),
            version: '1.0.0',
          },
        });
      } catch (error: any) {
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

        return reply.status(400).send({
          success: false,
          error: {
            code: 'CREATE_SWAP_ERROR',
            message: error.message,
          },
        });
      }
    },
  });

  /**
   * GET /api/v1/swap/:swapId
   * Get swap status
   */
  fastify.get('/:swapId', {
    schema: {
      description: 'Get swap by ID',
      tags: ['Swap'],
      params: {
        type: 'object',
        properties: {
          swapId: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { swapId: string } }>,
      reply: FastifyReply
    ) => {
      const { swapId } = request.params;
      
      const swap = await swapService.getSwap(swapId);
      
      if (!swap) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SWAP_NOT_FOUND',
            message: 'Swap not found',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: swap,
        meta: {
          requestId: request.id,
          timestamp: Date.now(),
          version: '1.0.0',
        },
      });
    },
  });

  /**
   * GET /api/v1/swap/:swapId/transaction
   * Get pending transaction for current step
   */
  fastify.get('/:swapId/transaction', {
    schema: {
      description: 'Get pending transaction data for signing',
      tags: ['Swap'],
      params: {
        type: 'object',
        properties: {
          swapId: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { swapId: string } }>,
      reply: FastifyReply
    ) => {
      const { swapId } = request.params;

      try {
        const swap = await swapService.getSwap(swapId);
        
        if (!swap) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'SWAP_NOT_FOUND',
              message: 'Swap not found',
            },
          });
        }

        if (swap.status === 'COMPLETED' || swap.status === 'FAILED') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'SWAP_FINISHED',
              message: `Swap is ${swap.status.toLowerCase()}`,
            },
          });
        }

        const tx = await swapService.getPendingTransaction(
          swapId,
          swap.currentStepIndex
        );

        return reply.status(200).send({
          success: true,
          data: {
            swapId,
            stepIndex: swap.currentStepIndex,
            step: swap.steps[swap.currentStepIndex],
            transaction: tx,
          },
          meta: {
            requestId: request.id,
            timestamp: Date.now(),
            version: '1.0.0',
          },
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'TRANSACTION_ERROR',
            message: error.message,
          },
        });
      }
    },
  });

  /**
   * POST /api/v1/swap/:swapId/execute
   * Execute current step with signed transaction
   */
  fastify.post('/:swapId/execute', {
    schema: {
      description: 'Execute swap step with signed transaction',
      tags: ['Swap'],
      params: {
        type: 'object',
        properties: {
          swapId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['signedTransaction'],
        properties: {
          signedTransaction: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: { swapId: string };
        Body: { signedTransaction: string };
      }>,
      reply: FastifyReply
    ) => {
      const { swapId } = request.params;

      try {
        const { signedTransaction } = executeStepSchema.parse(request.body);

        const swap = await swapService.getSwap(swapId);
        
        if (!swap) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'SWAP_NOT_FOUND',
              message: 'Swap not found',
            },
          });
        }

        const result = await swapService.executeStep({
          swapId,
          stepIndex: swap.currentStepIndex,
          signedTransaction,
        });

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'EXECUTION_FAILED',
              message: result.error || 'Transaction execution failed',
            },
          });
        }

        // Get updated swap
        const updatedSwap = await swapService.getSwap(swapId);

        return reply.status(200).send({
          success: true,
          data: {
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            swap: updatedSwap,
          },
          meta: {
            requestId: request.id,
            timestamp: Date.now(),
            version: '1.0.0',
          },
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
            },
          });
        }

        return reply.status(500).send({
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error.message,
          },
        });
      }
    },
  });

  /**
   * GET /api/v1/swap/:swapId/steps
   * Get all steps with detailed status
   */
  fastify.get('/:swapId/steps', {
    schema: {
      description: 'Get detailed step information',
      tags: ['Swap'],
      params: {
        type: 'object',
        properties: {
          swapId: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { swapId: string } }>,
      reply: FastifyReply
    ) => {
      const { swapId } = request.params;

      const swap = await swapService.getSwap(swapId);
      
      if (!swap) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'SWAP_NOT_FOUND',
            message: 'Swap not found',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          swapId,
          status: swap.status,
          currentStepIndex: swap.currentStepIndex,
          totalSteps: swap.steps.length,
          steps: swap.steps.map((step, index) => ({
            index,
            type: step.type,
            chainId: step.chainId,
            protocol: step.protocol,
            status: step.status,
            txHash: step.txHash,
            blockNumber: step.blockNumber,
            inputToken: step.inputToken,
            outputToken: step.outputToken,
            inputAmount: step.inputAmount,
            expectedOutput: step.expectedOutput,
            actualOutput: step.actualOutput,
            estimatedTime: step.estimatedTime,
            error: step.error,
            startedAt: step.startedAt,
            completedAt: step.completedAt,
          })),
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
   * GET /api/v1/swap/history
   * Get user's swap history
   */
  fastify.get('/history', {
    schema: {
      description: 'Get swap history for authenticated user',
      tags: ['Swap'],
      querystring: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 },
          status: { type: 'string' },
        },
      },
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          address?: string;
          limit?: number;
          offset?: number;
          status?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { address, limit = 20, offset = 0, status } = request.query;

      if (!address) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'ADDRESS_REQUIRED',
            message: 'Wallet address is required',
          },
        });
      }

      const swaps = await swapService.getSwapsByUser(address, limit, offset);

      // Filter by status if provided
      const filteredSwaps = status
        ? swaps.filter(s => s.status === status)
        : swaps;

      return reply.status(200).send({
        success: true,
        data: filteredSwaps,
        pagination: {
          limit,
          offset,
          total: filteredSwaps.length,
        },
        meta: {
          requestId: request.id,
          timestamp: Date.now(),
          version: '1.0.0',
        },
      });
    },
  });
}
