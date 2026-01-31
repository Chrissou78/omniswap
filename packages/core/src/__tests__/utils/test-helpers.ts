import { Prisma } from '@prisma/client';

// ============================================================================
// Mock Data Factories
// ============================================================================

export function createMockUser(overrides = {}) {
  return {
    id: 'user_test123',
    email: 'test@example.com',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockToken(overrides = {}) {
  return {
    address: '0xtoken123',
    symbol: 'TEST',
    name: 'Test Token',
    decimals: 18,
    chainId: 1,
    logoURI: 'https://example.com/token.png',
    price: 100,
    priceChange24h: 5.5,
    ...overrides,
  };
}

export function createMockPriceAlert(overrides = {}) {
  return {
    id: 'alert_test123',
    userId: 'user_test123',
    tokenAddress: '0xtoken123',
    tokenSymbol: 'TEST',
    tokenName: 'Test Token',
    tokenLogoURI: 'https://example.com/token.png',
    chainId: 1,
    alertType: 'ABOVE' as const,
    targetPrice: new Prisma.Decimal(150),
    targetPercentChange: null,
    priceAtCreation: new Prisma.Decimal(100),
    isEnabled: true,
    isRecurring: false,
    cooldownMinutes: 0,
    lastTriggeredAt: null,
    triggerCount: 0,
    notifyEmail: true,
    notifyPush: true,
    notifyTelegram: false,
    telegramChatId: null,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockLimitOrder(overrides = {}) {
  return {
    id: 'order_test123',
    userId: 'user_test123',
    tenantId: null,
    orderType: 'BUY' as const,
    status: 'PENDING' as const,
    inputTokenAddress: '0xusdc123',
    inputTokenSymbol: 'USDC',
    inputTokenDecimals: 6,
    inputTokenLogoURI: 'https://example.com/usdc.png',
    inputChainId: 1,
    inputAmount: new Prisma.Decimal(1000),
    outputTokenAddress: '0xeth123',
    outputTokenSymbol: 'ETH',
    outputTokenDecimals: 18,
    outputTokenLogoURI: 'https://example.com/eth.png',
    outputChainId: 1,
    outputAmount: new Prisma.Decimal(0.5),
    targetPrice: new Prisma.Decimal(2000),
    currentPrice: new Prisma.Decimal(2100),
    executionPrice: null,
    priceAtCreation: new Prisma.Decimal(2100),
    slippageBps: 50,
    expiresAt: new Date(Date.now() + 86400000),
    partialFillAllowed: false,
    filledAmount: new Prisma.Decimal(0),
    fillPercent: new Prisma.Decimal(0),
    platformFeeBps: 40,
    platformFeeAmount: null,
    gasFeeEstimate: null,
    gasFeeActual: null,
    txHash: null,
    blockNumber: null,
    routeData: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    executedAt: null,
    cancelledAt: null,
    fills: [],
    ...overrides,
  };
}

export function createMockDCAStrategy(overrides = {}) {
  return {
    id: 'dca_test123',
    userId: 'user_test123',
    tenantId: null,
    name: 'Test DCA Strategy',
    status: 'ACTIVE' as const,
    inputTokenAddress: '0xusdc123',
    inputTokenSymbol: 'USDC',
    inputTokenDecimals: 6,
    inputTokenLogoURI: 'https://example.com/usdc.png',
    inputChainId: 1,
    outputTokenAddress: '0xeth123',
    outputTokenSymbol: 'ETH',
    outputTokenDecimals: 18,
    outputTokenLogoURI: 'https://example.com/eth.png',
    outputChainId: 1,
    amountPerExecution: new Prisma.Decimal(100),
    frequency: 'DAILY' as const,
    customIntervalMs: null,
    totalExecutions: 30,
    executionsCompleted: 5,
    nextExecutionAt: new Date(Date.now() + 86400000),
    slippageBps: 100,
    maxPriceImpactBps: 300,
    skipOnHighGas: false,
    maxGasUsd: null,
    totalInputSpent: new Prisma.Decimal(500),
    totalOutputReceived: new Prisma.Decimal(0.25),
    averagePrice: new Prisma.Decimal(2000),
    platformFeeBps: 40,
    totalPlatformFees: new Prisma.Decimal(2),
    totalGasFees: new Prisma.Decimal(5),
    consecutiveFailures: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    pausedAt: null,
    completedAt: null,
    cancelledAt: null,
    executions: [],
    ...overrides,
  };
}

export function createMockDCAExecution(overrides = {}) {
  return {
    id: 'exec_test123',
    strategyId: 'dca_test123',
    executionNumber: 1,
    status: 'COMPLETED' as const,
    inputAmount: new Prisma.Decimal(100),
    outputAmount: new Prisma.Decimal(0.05),
    executionPrice: new Prisma.Decimal(2000),
    priceImpactBps: 10,
    platformFeeAmount: new Prisma.Decimal(0.4),
    gasFeeAmount: new Prisma.Decimal(1),
    txHash: '0xtx123',
    blockNumber: BigInt(12345678),
    routeData: null,
    errorMessage: null,
    scheduledAt: new Date(),
    startedAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  };
}

export function createMockAlertHistory(overrides = {}) {
  return {
    id: 'history_test123',
    alertId: 'alert_test123',
    tokenSymbol: 'TEST',
    tokenLogoURI: 'https://example.com/token.png',
    chainId: 1,
    alertType: 'ABOVE' as const,
    targetPrice: new Prisma.Decimal(150),
    targetPercentChange: null,
    triggeredPrice: new Prisma.Decimal(155),
    notificationsSent: ['email', 'push'],
    triggeredAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Mock Service Factories
// ============================================================================

export function createMockPriceService() {
  return {
    getTokenPrice: jest.fn().mockResolvedValue(100),
    getTokenPrices: jest.fn().mockResolvedValue({ '0xtoken123': 100 }),
    getPriceHistory: jest.fn().mockResolvedValue([]),
  };
}

export function createMockQuoteService() {
  return {
    getQuote: jest.fn().mockResolvedValue({
      id: 'quote_123',
      routes: [
        {
          outputAmount: '0.5',
          priceImpactBps: 10,
          estimatedGas: '100000',
        },
      ],
    }),
  };
}

export function createMockSwapService() {
  return {
    executeSwap: jest.fn().mockResolvedValue({
      txHash: '0xtx123',
      outputAmount: '0.5',
      blockNumber: 12345678,
      gasFee: '0.01',
    }),
  };
}

export function createMockNotificationService() {
  return {
    sendEmailAlert: jest.fn().mockResolvedValue(undefined),
    sendPushAlert: jest.fn().mockResolvedValue(undefined),
    sendTelegramAlert: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockGasService() {
  return {
    getGasPriceUsd: jest.fn().mockResolvedValue(5),
    estimateGas: jest.fn().mockResolvedValue('100000'),
  };
}

export function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    remove: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockResolvedValue(null),
  };
}
