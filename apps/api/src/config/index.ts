// apps/api/src/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/omniswap',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // DEX APIs
  oneInch: {
    apiKey: process.env.ONEINCH_API_KEY || '',
    baseUrl: 'https://api.1inch.dev',
  },
  
  jupiter: {
    baseUrl: 'https://quote-api.jup.ag/v6',
  },
  
  cetus: {
    baseUrl: 'https://api-sui.cetus.zone',
  },
  
  lifi: {
    apiKey: process.env.LIFI_API_KEY || '',
    baseUrl: 'https://li.quest/v1',
  },
  
  // CEX
  mexc: {
    baseUrl: 'https://api.mexc.com',
  },
  
  // Platform fees
  fees: {
    onChainSwap: 0.004,      // 0.4%
    crossChainSwap: 0.005,   // 0.5%
    cexTrade: 0.01,          // 1%
  },
};
