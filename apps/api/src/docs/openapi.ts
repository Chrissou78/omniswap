import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'OmniSwap API',
      version: '1.0.0',
      description: `
# OmniSwap Multi-Chain DEX Aggregator API

OmniSwap provides a unified API for swapping tokens across multiple chains including EVM networks (Ethereum, Polygon, Arbitrum, etc.), Solana, and Sui.

## Features

- **Multi-chain swaps**: Execute swaps across 9+ supported chains
- **Cross-chain routing**: Bridge and swap in a single transaction via Li.Fi and Wormhole
- **Price alerts**: Get notified when tokens reach your target prices
- **Limit orders**: Set buy/sell orders at specific price points
- **DCA strategies**: Automate dollar-cost averaging investments
- **Portfolio tracking**: Track holdings across all chains

## Authentication

All endpoints require authentication via JWT Bearer token or API key.

\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

or

\`\`\`
X-API-Key: <api_key>
\`\`\`

## Rate Limits

| Tier | Requests/min | Requests/day |
|------|-------------|--------------|
| Free | 60 | 1,000 |
| Pro | 300 | 50,000 |
| Enterprise | 1,000 | Unlimited |

## Fees

- On-chain swaps: 0.4% (40 bps)
- MEXC trades: 1% + withdrawal cost
- Limit orders: 0.4%
- DCA: 0.4% per execution
      `,
      contact: {
        name: 'OmniSwap Support',
        email: 'support@omniswap.io',
        url: 'https://omniswap.io/support',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://api.omniswap.io',
        description: 'Production',
      },
      {
        url: 'https://api-staging.omniswap.io',
        description: 'Staging',
      },
      {
        url: 'http://localhost:3001',
        description: 'Local Development',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Quote', description: 'Get swap quotes and routes' },
      { name: 'Swap', description: 'Execute token swaps' },
      { name: 'Tokens', description: 'Token information and lists' },
      { name: 'Price Alerts', description: 'Manage price alerts' },
      { name: 'Limit Orders', description: 'Manage limit orders' },
      { name: 'DCA', description: 'Dollar-cost averaging strategies' },
      { name: 'Portfolio', description: 'Portfolio tracking' },
      { name: 'Admin', description: 'Admin endpoints (tenant management)' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for programmatic access',
        },
      },
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] },
    ],
  },
  apis: [
    './src/docs/schemas/*.yaml',
    './src/docs/paths/*.yaml',
  ],
};

export const openapiSpecification = swaggerJsdoc(options);
