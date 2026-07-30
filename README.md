# OmniSwap Aggregator

OmniSwap is a multi-chain, multi-tenant DeFi swap aggregator platform. It lets users find the best swap route across dozens of chains and DEXs, and gives operators a white-labelable stack (web app, admin dashboard, API, and mobile app) for running their own branded swap product.

## Monorepo layout

```
apps/
  web/      Next.js 15 — the public-facing swap app (also hosts the admin UI and most API routes)
  admin/    Standalone admin dashboard
  api/      Fastify backend service (quotes, swaps, DCA, limit orders, alerts, tenant config, websockets)
  mobile/   Expo / React Native app

packages/
  core/       Swap execution engine, DEX adapters, GoPlus security audits, Redis client, transaction monitor
  database/   Prisma schema (PostgreSQL) shared by web + api
  shared/     Shared chain/token data, hooks, and utilities
  types/      Shared TypeScript types (tokens, quotes, swaps, tenant, API)
  config/     Shared configuration
  contracts/  Smart contracts
  ui/         Shared UI components

tenants/      Per-tenant white-label overrides (e.g. cryptoflow, defihub, swapx)
docker/       Per-app Dockerfiles
k8s/          Kubernetes manifests (production)
terraform/    AWS + Kubernetes infrastructure-as-code
monitoring/   Prometheus config
```

Managed with **pnpm workspaces** + **Turborepo**.

## What it can do

### Swapping & routing
- Aggregates routes across **~30 chains** — Ethereum, BNB Chain, Polygon, Arbitrum, Base, Optimism, Avalanche, Solana, Sui, zkSync Era, Linea, Blast, Scroll, Mantle, Sonic, Berachain, Gnosis, Celo, Metis, Polygon zkEVM, Zora, World Chain, Manta, Mode, Moonbeam, Moonriver, Cronos, Aurora, Tron, HyperEVM, Plasma — spanning EVM, Solana, Sui, and Tron.
- DEX/bridge integrations: **1inch** and **LI.FI** (cross-chain bridging) for EVM, **Jupiter** for Solana.
- Multi-step swap execution with per-step status/tx tracking (bridge → swap → deliver).
- **Gasless / delegated swaps** via a permit-based flow (fee collection, route comparison between direct vs. delegated execution).

### Trading tools
- **DCA (dollar-cost averaging)** strategies — recurring buys with configurable frequency (hourly to monthly, or custom), slippage/price-impact/gas guards.
- **Limit orders** — buy/sell at a target price with expiry and execution tracking.
- **Price alerts** — trigger above/below/percent-change, with email, push, and Telegram notification options.
- **Portfolio tracking** — holdings, cost basis, PnL, and historical snapshots.

### Token intelligence
- **Security audits** for any token via GoPlus (honeypot, mint/proxy/blacklist risk, buy/sell tax, ownership, liquidity, top holders).
- **Custom token listing requests** — projects can submit a token for listing with a paid, admin-reviewed workflow.
- Token discovery/search across chains, backed by a verified token registry with live price/market-cap/volume/liquidity data.

### Monetization
- **Ad slots** on the swap widget (position, size, base price) with **bookings** (volume + advance-booking discounts, approval workflow, on-chain or card payment, impression/click tracking).
- **Token listing fees**, configurable per platform.
- **Stripe** for card payments alongside crypto payment (wallet tx hash tracking on-chain per chain).

### Multi-tenancy / white-labeling
- Each **tenant** gets its own slug, custom domain(s), plan, branding/theme/features/fees/localization/legal config, admin accounts (with MFA), API keys, curated token lists, and daily revenue rollups per chain.
- Swaps, DCA strategies, and limit orders are all tenant-scoped.

### Admin dashboard
- Manage chains, tokens, ad slots/bookings/requests, and platform-wide settings (ad pricing, discount tiers, listing fees, accepted payment chains/wallet) from a dedicated `/admin` area.

### Wallet support
- EVM wallets via **wagmi/viem**, Solana via the **Solana wallet adapter**, Sui via **@mysten/dapp-kit**.

### Mobile app
- Expo/React Native app with tabbed swap/wallet/settings screens, biometric-secured local key storage, and localization — shares the same core/shared/types packages as the web app.

### Infrastructure
- **Docker** (dev/prod compose files, per-app Dockerfiles) and **Kubernetes** manifests (deployments, services, ingress, autoscaling) for production.
- **Terraform** for AWS + Kubernetes infra provisioning.
- **Prometheus** monitoring config.
- **Vercel** config for serverless deployment of the web app, and **EAS**/**Fastlane** for mobile app store builds.

## Getting started

```bash
pnpm install
pnpm build:shared      # build the shared package (also runs automatically via prebuild)
pnpm dev                # run everything via Turborepo
pnpm dev:web            # just the web app
pnpm dev:mobile         # just the mobile app
```

Database (from `packages/database`):
```bash
pnpm db:generate        # generate the Prisma client
pnpm db:push            # push schema to your database
pnpm db:studio          # open Prisma Studio
```

Docker (local stack):
```bash
pnpm docker:up
pnpm docker:down
```

## Tech stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind
- **Backend**: Fastify (`apps/api`), Next.js API routes (`apps/web`)
- **Database**: PostgreSQL via Prisma
- **Mobile**: Expo / React Native
- **Chains**: viem/wagmi, @solana/web3.js, @mysten/sui
- **Build**: pnpm workspaces, Turborepo
