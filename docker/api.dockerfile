# docker/api.Dockerfile
# Location: omniswap/docker/api.Dockerfile

# ============ BASE ============
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Install dependencies needed for node-gyp
RUN apk add --no-cache python3 make g++

WORKDIR /app

# ============ DEPENDENCIES ============
FROM base AS dependencies

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all package.json files
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/core/package.json ./packages/core/
COPY packages/utils/package.json ./packages/utils/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ============ DEVELOPMENT ============
FROM dependencies AS development

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @omniswap/api prisma generate

# Expose port
EXPOSE 3001

# Start development server with hot reload
CMD ["pnpm", "--filter", "@omniswap/api", "dev"]

# ============ BUILDER ============
FROM dependencies AS builder

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @omniswap/api prisma generate

# Build all packages
RUN pnpm --filter @omniswap/types build
RUN pnpm --filter @omniswap/utils build
RUN pnpm --filter @omniswap/core build
RUN pnpm --filter @omniswap/api build

# ============ PRODUCTION ============
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
