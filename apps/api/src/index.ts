// apps/api/src/index.ts

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';

import { config } from './config';
import { RedisClient, getRedis } from './utils/redis';
import { QueueManager, QUEUES } from './utils/queue';
import { setupWorkers, scheduleTokenSync } from './workers';
import configRoutes from './routes/config';

import express from 'express';
import { setupSwagger } from './docs/swagger';

// Services
import {
  AdapterRegistry,
  QuoteService,
  SwapService,
  TokenRegistryService,
  TransactionMonitorService,
  ExecutorRegistry,
  TokenService,
  PriceService,
  GasService,
} from '@omniswap/core';

// Routes
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { quoteRoutes } from './routes/quotes';
import { swapRoutes } from './routes/swaps';
import { tokenRoutes } from './routes/tokens';
import { websocketRoutes } from './routes/websocket';
import { tenantMiddleware } from './middleware/tenant';
import { errorHandler } from './middleware/errorHandler';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClient;
    quoteService: QuoteService;
    swapService: SwapService;
    tokenRegistryService: TokenRegistryService;
  }
}

async function bootstrap() {
  // Initialize Fastify
  const app = Fastify({
    logger: {
      level: config.env === 'development' ? 'debug' : 'info',
    },
    requestIdHeader: 'x-request-id',
  });

  app.use('/api/v1/config', configRoutes);

  // ============ PLUGINS ============
  
  await app.register(helmet);
  await app.register(cors, {
    origin: config.cors.origins,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });
  await app.register(jwt, {
    secret: config.jwt.secret,
  });
  await app.register(websocket);

  // ============ INITIALIZE SERVICES ============

  console.log('Initializing services...');

  // Redis
  const redis = getRedis({ url: config.redis.url });
  app.decorate('redis', redis);

  // Queue Manager
  const queueManager = new QueueManager({
    redis: {
      host: new URL(config.redis.url).hostname,
      port: parseInt(new URL(config.redis.url).port || '6379'),
    },
  });

  const app = express();

  // Adapters
  const adapterRegistry = new AdapterRegistry({
    oneInch: config.oneInch.apiKey ? { apiKey: config.oneInch.apiKey } : undefined,
    lifi: { apiKey: config.lifi.apiKey },
    jupiter: {},
    cetus: {},
    mexc: config.mexc.apiKey ? {
      apiKey: config.mexc.apiKey,
      secretKey: config.mexc.secretKey,
    } : undefined,
  });

  // Executors
  const executorRegistry = new ExecutorRegistry();

  // Token Service
  const tokenService = new TokenService({
    cacheEnabled: true,
    cacheTTL: 300,
  });

  // Price Service
  const priceService = new PriceService({
    cacheTTL: 60,
  });

  // Gas Service
  const gasService = new GasService({
    cacheTTL: 30,
  });

  // Quote Service
  const quoteService = new QuoteService({
    adapterRegistry,
    tokenService,
    priceService,
    gasService,
    quoteExpirationMs: 60000, // 1 minute
    maxRoutesReturned: 5,
    enableCexRouting: !!config.mexc.apiKey,
  });
  app.decorate('quoteService', quoteService);

  // Swap Service
  const swapService = new SwapService({
    executorRegistry,
    quoteService,
    redis,
    onSwapUpdate: async (swap) => {
      await redis.publish('swap-updates', {
        type: 'SWAP_UPDATE',
        swapId: swap.id,
        status: swap.status,
        currentStepIndex: swap.currentStepIndex,
      });
    },
    onStepUpdate: async (swap, stepIndex) => {
      const step = swap.steps[stepIndex];
      await redis.publish('step-updates', {
        type: 'STEP_UPDATE',
        swapId: swap.id,
        stepIndex,
        status: step.status,
        txHash: step.txHash,
      });

      // Add to monitor if transaction submitted
      if (step.txHash && step.status === 'CONFIRMING') {
        await queueManager.addJob(QUEUES.TRANSACTION_MONITOR, {
          swapId: swap.id,
          stepIndex,
          chainId: step.chainId,
          txHash: step.txHash,
          type: step.chainId === 'solana' ? 'SOLANA' 
              : step.chainId === 'sui' ? 'SUI'
              : step.type === 'BRIDGE' ? 'BRIDGE'
              : 'EVM',
        });
      }
    },
  });
  app.decorate('swapService', swapService);

  // Token Registry Service
  const tokenRegistryService = new TokenRegistryService({
    redis,
    oneInchAdapter: adapterRegistry.getAdapter('1inch') as any,
    jupiterAdapter: adapterRegistry.getAdapter('jupiter') as any,
    cetusAdapter: adapterRegistry.getAdapter('cetus') as any,
    syncIntervalHours: 6,
    onSyncComplete: (source, count) => {
      console.log(`[TokenRegistry] ${source} sync complete: ${count} tokens`);
    },
  });
  app.decorate('tokenRegistryService', tokenRegistryService);

  // Transaction Monitor Service
  const monitorService = new TransactionMonitorService({
    executorRegistry,
    swapService,
    redis,
    lifiAdapter: adapterRegistry.getAdapter('lifi') as any,
    evmPollInterval: 5000,      // 5 seconds
    solanaPollInterval: 2000,   // 2 seconds
    suiPollInterval: 2000,      // 2 seconds
    bridgePollInterval: 10000,  // 10 seconds
    onStatusChange: (swap, stepIndex, status) => {
      console.log(`[Monitor] ${swap.id} step ${stepIndex}: ${status.status}`);
    },
  });

  // ============ MIDDLEWARE ============

  app.addHook('onRequest', tenantMiddleware);
  app.setErrorHandler(errorHandler);

  // ============ ROUTES ============

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(quoteRoutes, { prefix: '/api/v1/quote' });
  await app.register(swapRoutes, { prefix: '/api/v1/swap' });
  await app.register(tokenRoutes, { prefix: '/api/v1/tokens' });
  await app.register(websocketRoutes);

  // ============ STARTUP ============

  // Load cached tokens
  await tokenRegistryService.loadFromCache();

  // Start transaction monitor
  await monitorService.loadPersistedTransactions();
  monitorService.start();

  // Setup workers
  setupWorkers(queueManager, {
    swapService,
    monitorService,
    tokenRegistryService,
  });

  // Schedule token sync
  scheduleTokenSync(queueManager);

  // Initial token sync (background)
  tokenRegistryService.startAutoSync();

  // Setup API documentation
  setupSwagger(app);


  // ============ START SERVER ============

  try {
    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });
    
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 OmniSwap API Server Started                              ║
║                                                               ║
║   REST API:    http://localhost:${config.port}/api/v1          ║
║   WebSocket:   ws://localhost:${config.port}/ws                ║
║   Health:      http://localhost:${config.port}/health          ║
║                                                               ║
║   Environment: ${config.env.padEnd(43)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      
      monitorService.stop();
      tokenRegistryService.stopAutoSync();
      await queueManager.close();
      await redis.disconnect();
      await app.close();
      
      process.exit(0);
    });
  }
}



bootstrap();
