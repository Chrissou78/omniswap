// apps/api/src/routes/websocket.ts

import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { RedisClient } from '../utils/redis';
import { Swap } from '@omniswap/types';

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  tenantId: string;
}

export async function websocketRoutes(fastify: FastifyInstance) {
  const redis = fastify.redis as RedisClient;
  const clients: Map<string, WebSocketClient> = new Map();

  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    const clientId = Math.random().toString(36).substring(7);
    const tenantId = request.tenantId || 'default';

    const client: WebSocketClient = {
      ws: connection.socket,
      subscriptions: new Set(),
      tenantId,
    };

    clients.set(clientId, client);
    console.log(`[WS] Client connected: ${clientId}`);

    // Send welcome message
    send(connection.socket, {
      type: 'CONNECTED',
      clientId,
      timestamp: Date.now(),
    });

    // Handle messages
    connection.socket.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(clientId, client, message);
      } catch (error) {
        send(connection.socket, {
          type: 'ERROR',
          message: 'Invalid message format',
        });
      }
    });

    // Handle disconnect
    connection.socket.on('close', () => {
      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });

    // Handle errors
    connection.socket.on('error', (error) => {
      console.error(`[WS] Client error ${clientId}:`, error);
      clients.delete(clientId);
    });
  });

  // Message handler
  async function handleMessage(
    clientId: string,
    client: WebSocketClient,
    message: any
  ): Promise<void> {
    switch (message.type) {
      case 'AUTH':
        // Authenticate user (JWT validation)
        try {
          const decoded = fastify.jwt.verify(message.token);
          client.userId = (decoded as any).userId;
          send(client.ws, {
            type: 'AUTH_SUCCESS',
            userId: client.userId,
          });
        } catch {
          send(client.ws, {
            type: 'AUTH_FAILED',
            message: 'Invalid token',
          });
        }
        break;

      case 'SUBSCRIBE_SWAP':
        // Subscribe to swap updates
        const swapId = message.swapId;
        if (!swapId) {
          send(client.ws, {
            type: 'ERROR',
            message: 'swapId required',
          });
          return;
        }

        client.subscriptions.add(`swap:${swapId}`);
        send(client.ws, {
          type: 'SUBSCRIBED',
          channel: `swap:${swapId}`,
        });

        // Send current swap status
        const swap = await fastify.swapService.getSwap(swapId);
        if (swap) {
          send(client.ws, {
            type: 'SWAP_STATUS',
            swap: sanitizeSwap(swap),
          });
        }
        break;

      case 'UNSUBSCRIBE_SWAP':
        client.subscriptions.delete(`swap:${message.swapId}`);
        send(client.ws, {
          type: 'UNSUBSCRIBED',
          channel: `swap:${message.swapId}`,
        });
        break;

      case 'SUBSCRIBE_USER':
        // Subscribe to all user's swaps
        if (!client.userId) {
          send(client.ws, {
            type: 'ERROR',
            message: 'Authentication required',
          });
          return;
        }

        client.subscriptions.add(`user:${client.userId}`);
        send(client.ws, {
          type: 'SUBSCRIBED',
          channel: `user:${client.userId}`,
        });
        break;

      case 'PING':
        send(client.ws, { type: 'PONG', timestamp: Date.now() });
        break;

      default:
        send(client.ws, {
          type: 'ERROR',
          message: `Unknown message type: ${message.type}`,
        });
    }
  }

  // Subscribe to Redis for swap updates
  await redis.subscribe('swap-updates', (message) => {
    const { swapId, status, currentStepIndex } = message;

    // Broadcast to subscribed clients
    for (const [clientId, client] of clients) {
      if (client.subscriptions.has(`swap:${swapId}`)) {
        send(client.ws, {
          type: 'SWAP_UPDATE',
          swapId,
          status,
          currentStepIndex,
          timestamp: Date.now(),
        });
      }
    }
  });

  // Subscribe to step updates
  await redis.subscribe('step-updates', (message) => {
    const { swapId, stepIndex, status, txHash } = message;

    for (const [clientId, client] of clients) {
      if (client.subscriptions.has(`swap:${swapId}`)) {
        send(client.ws, {
          type: 'STEP_UPDATE',
          swapId,
          stepIndex,
          status,
          txHash,
          timestamp: Date.now(),
        });
      }
    }
  });

  // Helper to send messages
  function send(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // Sanitize swap for client
  function sanitizeSwap(swap: Swap): any {
    return {
      id: swap.id,
      status: swap.status,
      currentStepIndex: swap.currentStepIndex,
      inputAmount: swap.inputAmount,
      expectedOutput: swap.expectedOutput,
      actualOutput: swap.actualOutput,
      steps: swap.steps.map(step => ({
        type: step.type,
        chainId: step.chainId,
        protocol: step.protocol,
        status: step.status,
        txHash: step.txHash,
        inputToken: {
          symbol: step.inputToken.symbol,
          chainId: step.inputToken.chainId,
        },
        outputToken: {
          symbol: step.outputToken.symbol,
          chainId: step.outputToken.chainId,
        },
        inputAmount: step.inputAmount,
        expectedOutput: step.expectedOutput,
        estimatedTime: step.estimatedTime,
      })),
      createdAt: swap.createdAt,
      completedAt: swap.completedAt,
      error: swap.error,
    };
  }

  // Heartbeat to keep connections alive
  setInterval(() => {
    for (const [clientId, client] of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        send(client.ws, { type: 'HEARTBEAT', timestamp: Date.now() });
      }
    }
  }, 30000); // Every 30 seconds
}
