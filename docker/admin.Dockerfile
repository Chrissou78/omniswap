# docker/admin.Dockerfile
# Location: omniswap/docker/admin.Dockerfile

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# ============ DEPENDENCIES ============
FROM base AS dependencies

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/

RUN pnpm install --frozen-lockfile

# ============ DEVELOPMENT ============
FROM dependencies AS development

COPY . .

EXPOSE 3002

CMD ["pnpm", "--filter", "@omniswap/admin", "dev", "--", "-p", "3002"]

# ============ PRODUCTION ============
FROM dependencies AS builder
COPY . .
RUN pnpm --filter @omniswap/types build
RUN pnpm --filter @omniswap/ui build
RUN pnpm --filter @omniswap/admin build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3002
CMD ["node", "apps/admin/server.js"]
