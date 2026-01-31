import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

// Core Services
import { WalletService, WalletConfig } from '@omniswap/core/services/wallet.service';
import { PriceService } from '@omniswap/core/services/price.service';
import { QuoteService } from '@omniswap/core/services/quote.service';
import { SwapService } from '@omniswap/core/services/swap.service';
import { AlertService } from '@omniswap/core/services/alert.service';
import { LimitOrderService } from '@omniswap/core/services/limit-order.service';
import { DCAService } from '@omniswap/core/services/dca.service';
import { NotificationService } from '@omniswap/core/services/notification.service';
import { GoPlusService } from '@omniswap/core/services/goplus.service';

// Adapters
import { OneInchAdapter } from '@omniswap/core/adapters/oneinch.adapter';
import { JupiterAdapter } from '@omniswap/core/adapters/jupiter.adapter';
import { CetusAdapter } from '@omniswap/core/adapters/cetus.adapter';
import { LiFiAdapter } from '@omniswap/core/adapters/lifi.adapter';

import { logger } from '../utils/logger';

export interface Services {
  prisma: PrismaClient;
  redis: Redis;
  walletService: WalletService;
  priceService: PriceService;
  quoteService: QuoteService;
  swapService: SwapService;
  alertService: AlertService;
  limitOrderService: LimitOrderService;
  dcaService: DCAService;
  notificationService: NotificationService;
  goPlusService: GoPlusService;
  queues: {
    alertCheck: Queue;
    limitOrderCheck: Queue;
    dcaExecution: Queue;
  };
}

export async function initializeServices(): Promise<Services> {
  logger.info('Initializing services...');

  // Database
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
  await prisma.$connect();
  logger.info('Database connected');

  // Redis
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  logger.info('Redis connected');

  // BullMQ Queues
  const queueConnection = { connection: redis };
  const alertCheckQueue = new Queue('alert-check', queueConnection);
  const limitOrderCheckQueue = new Queue('limit-order-check', queueConnection);
  const dcaExecutionQueue = new Queue('dca-execution', queueConnection);
  logger.info('Queues initialized');

  // Adapters
  const oneInchAdapter = new OneInchAdapter(process.env.ONEINCH_API_KEY || '');
  const jupiterAdapter = new JupiterAdapter(process.env.JUPITER_API_KEY);
  const cetusAdapter = new CetusAdapter();
  const lifiAdapter = new LiFiAdapter(process.env.LIFI_API_KEY);
  logger.info('DEX adapters initialized');

  // Wallet Service
  const walletConfig: WalletConfig = {
    evm: {
      rpcUrls: {
        1: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
        56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
        8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
        43114: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
      },
    },
    solana: {
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    },
    sui: {
      rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io',
    },
  };
  const walletService = new WalletService(walletConfig);
  logger.info('Wallet service initialized');

  // Core Services
  const priceService = new PriceService(redis);

  const quoteService = new QuoteService(
    redis,
    priceService,
    oneInchAdapter,
    jupiterAdapter,
    cetusAdapter,
    lifiAdapter
  );

  const notificationService = new NotificationService({
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    fcmServerKey: process.env.FCM_SERVER_KEY || '',
  });

  const swapService = new SwapService(
    prisma,
    redis,
    quoteService,
    walletService,
    oneInchAdapter,
    jupiterAdapter,
    cetusAdapter,
    lifiAdapter
  );

  const alertService = new AlertService(
    prisma,
    redis,
    priceService,
    notificationService,
    alertCheckQueue
  );

  const limitOrderService = new LimitOrderService(
    prisma,
    redis,
    priceService,
    quoteService,
    swapService,
    limitOrderCheckQueue
  );

  // Gas service stub for DCA
  const gasService = {
    getGasPriceUsd: async (chainId: number) => {
      const evmService = walletService.getEVMService();
      const gasData = await evmService.getGasPrice(chainId);
      // Rough USD estimate based on gas price
      const gasPriceGwei = parseFloat(gasData.maxFeePerGas) / 1e9;
      return gasPriceGwei * 0.00005; // Very rough estimate
    },
  };

  const dcaService = new DCAService(
    prisma,
    redis,
    priceService,
    quoteService,
    swapService,
    gasService as any,
    dcaExecutionQueue
  );

  const goPlusService = new GoPlusService(redis, process.env.GOPLUS_API_KEY);

  logger.info('All services initialized');

  return {
    prisma,
    redis,
    walletService,
    priceService,
    quoteService,
    swapService,
    alertService,
    limitOrderService,
    dcaService,
    notificationService,
    goPlusService,
    queues: {
      alertCheck: alertCheckQueue,
      limitOrderCheck: limitOrderCheckQueue,
      dcaExecution: dcaExecutionQueue,
    },
  };
}

export async function shutdownServices(services: Services): Promise<void> {
  logger.info('Shutting down services...');

  await services.queues.alertCheck.close();
  await services.queues.limitOrderCheck.close();
  await services.queues.dcaExecution.close();
  await services.redis.quit();
  await services.prisma.$disconnect();

  logger.info('Services shut down');
}
