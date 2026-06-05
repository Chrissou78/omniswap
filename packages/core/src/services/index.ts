// packages/core/src/services/index.ts

// Re-export services as stubs for now
// The actual implementations need to be updated to match the Prisma schema

export { NotificationService, notificationService } from './notification.service';

// Stub exports for services that need Prisma schema alignment
export const AlertService = class AlertService {
  constructor(...args: any[]) {}
};

export const DCAService = class DCAService {
  constructor(...args: any[]) {}
};

export const LimitOrderService = class LimitOrderService {
  constructor(...args: any[]) {}
};

export const SwapService = class SwapService {
  constructor(...args: any[]) {}
};

export const QuoteService = class QuoteService {
  constructor(...args: any[]) {}
};

export const PriceService = class PriceService {
  constructor(...args: any[]) {}
};

export const WalletService = class WalletService {
  constructor(...args: any[]) {}
};

export const GoPlusService = class GoPlusService {
  constructor(...args: any[]) {}
};

export const PortfolioService = class PortfolioService {
  constructor(...args: any[]) {}
};

export const TokenService = class TokenService {
  constructor(...args: any[]) {}
};

export const GasService = class GasService {
  constructor(...args: any[]) {}
};
