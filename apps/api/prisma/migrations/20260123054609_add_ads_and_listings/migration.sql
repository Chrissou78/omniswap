-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "DCAStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DCAFrequency" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DCAExecutionStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_ABOVE', 'PRICE_BELOW', 'PRICE_CHANGE_PERCENT');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AdBookingStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ListingRequestStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'LISTED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "domains" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfig" (
    "tenantId" TEXT NOT NULL,
    "branding" JSONB NOT NULL DEFAULT '{}',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '{}',
    "fees" JSONB NOT NULL DEFAULT '{}',
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "localization" JSONB NOT NULL DEFAULT '{}',
    "legal" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "TenantAdmin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantToken" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "decimals" INTEGER NOT NULL,
    "logoUrl" TEXT,
    "coingeckoId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "addedBy" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantRevenue" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "chainId" TEXT NOT NULL,
    "swapCount" INTEGER NOT NULL DEFAULT 0,
    "volumeUsd" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "platformFeesUsd" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "tenantFeesUsd" DECIMAL(20,2) NOT NULL DEFAULT 0,

    CONSTRAINT "TenantRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" SERIAL NOT NULL,
    "chainId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "decimals" INTEGER NOT NULL,
    "logoUrl" TEXT,
    "coingeckoId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sources" TEXT[],
    "priceUsd" DECIMAL(20,8),
    "marketCapUsd" DECIMAL(20,2),
    "volume24hUsd" DECIMAL(20,2),
    "liquidityUsd" DECIMAL(20,2),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "userAddress" TEXT NOT NULL,
    "inputChainId" TEXT NOT NULL,
    "inputToken" TEXT NOT NULL,
    "inputAmount" TEXT NOT NULL,
    "outputChainId" TEXT NOT NULL,
    "outputToken" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "minimumOutput" TEXT NOT NULL,
    "actualOutput" TEXT,
    "routeData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "platformFee" TEXT,
    "tenantFee" TEXT,
    "gasCost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "refundTxHash" TEXT,

    CONSTRAINT "Swap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapStep" (
    "id" SERIAL NOT NULL,
    "swapId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "inputToken" TEXT NOT NULL,
    "outputToken" TEXT NOT NULL,
    "inputAmount" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "actualOutput" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SwapStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "primaryAddress" TEXT,
    "email" TEXT,
    "username" TEXT,
    "avatar" TEXT,
    "preferences" JSONB,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "pushToken" TEXT,
    "telegramId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimitOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "fromChainId" TEXT NOT NULL,
    "toChainId" TEXT NOT NULL,
    "fromTokenAddress" TEXT NOT NULL,
    "toTokenAddress" TEXT NOT NULL,
    "fromTokenSymbol" TEXT NOT NULL,
    "toTokenSymbol" TEXT NOT NULL,
    "inputAmount" TEXT NOT NULL,
    "targetPrice" TEXT NOT NULL,
    "minOutputAmount" TEXT NOT NULL,
    "slippage" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "expiresAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "executedTxHash" TEXT,
    "executedPrice" TEXT,
    "outputAmount" TEXT,
    "platformFeeUsd" DOUBLE PRECISION,
    "gasCostUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "LimitOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DCAStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT,
    "status" "DCAStatus" NOT NULL DEFAULT 'ACTIVE',
    "fromChainId" TEXT NOT NULL,
    "toChainId" TEXT NOT NULL,
    "fromTokenAddress" TEXT NOT NULL,
    "toTokenAddress" TEXT NOT NULL,
    "fromTokenSymbol" TEXT NOT NULL,
    "toTokenSymbol" TEXT NOT NULL,
    "amountPerExecution" TEXT NOT NULL,
    "frequency" "DCAFrequency" NOT NULL,
    "customIntervalHours" INTEGER,
    "totalExecutions" INTEGER,
    "executedCount" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "nextExecutionAt" TIMESTAMP(3) NOT NULL,
    "lastExecutionAt" TIMESTAMP(3),
    "slippage" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxPriceImpact" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "skipOnHighGas" BOOLEAN NOT NULL DEFAULT false,
    "maxGasUsd" DOUBLE PRECISION,
    "totalInputAmount" TEXT NOT NULL DEFAULT '0',
    "totalOutputAmount" TEXT NOT NULL DEFAULT '0',
    "totalFeesPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averagePrice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "DCAStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DCAExecution" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "executionNumber" INTEGER NOT NULL,
    "status" "DCAExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "inputAmount" TEXT NOT NULL,
    "outputAmount" TEXT,
    "price" TEXT,
    "swapId" TEXT,
    "txHash" TEXT,
    "platformFeeUsd" DOUBLE PRECISION,
    "gasCostUsd" DOUBLE PRECISION,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DCAExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalValueUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnlPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioHolding" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "balanceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCostBasis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unrealizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unrealizedPnlPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isTracked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "totalValueUsd" DOUBLE PRECISION NOT NULL,
    "totalPnlUsd" DOUBLE PRECISION NOT NULL,
    "holdings" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggeredAt" TIMESTAMP(3),
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "notifyTelegram" BOOLEAN NOT NULL DEFAULT false,
    "telegramChatId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastNotifiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSlot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdBooking" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "altText" TEXT,
    "basePricePerDay" DOUBLE PRECISION NOT NULL,
    "volumeDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advanceDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalPrice" DOUBLE PRECISION NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "status" "AdBookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" TEXT,
    "paymentTxHash" TEXT,
    "paymentChainId" TEXT,
    "paidAt" TIMESTAMP(3),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenListingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "telegramHandle" TEXT,
    "projectRole" TEXT,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "totalSupply" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "whitepaperUrl" TEXT,
    "twitterUrl" TEXT,
    "telegramUrl" TEXT,
    "discordUrl" TEXT,
    "githubUrl" TEXT,
    "coingeckoId" TEXT,
    "coinmarketcapId" TEXT,
    "launchDate" TIMESTAMP(3),
    "isAudited" BOOLEAN NOT NULL DEFAULT false,
    "auditUrl" TEXT,
    "additionalNotes" TEXT,
    "listingFee" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "status" "ListingRequestStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectedReason" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" TEXT,
    "paymentTxHash" TEXT,
    "paymentChainId" TEXT,
    "paidAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenListingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "adBasePricePerDay" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "adRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "adVolumeDiscounts" JSONB NOT NULL DEFAULT '[]',
    "adAdvanceDiscountPerDay" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "adAdvanceDiscountPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "adMaxAdvanceDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "tokenListingFee" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "tokenListingRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "acceptedPaymentChains" JSONB NOT NULL DEFAULT '[]',
    "paymentWalletAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAdmin_tenantId_email_key" ON "TenantAdmin"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "TenantToken_tenantId_chainId_address_key" ON "TenantToken"("tenantId", "chainId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "TenantRevenue_tenantId_date_chainId_key" ON "TenantRevenue"("tenantId", "date", "chainId");

-- CreateIndex
CREATE INDEX "Token_symbol_idx" ON "Token"("symbol");

-- CreateIndex
CREATE INDEX "Token_chainId_idx" ON "Token"("chainId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_chainId_address_key" ON "Token"("chainId", "address");

-- CreateIndex
CREATE INDEX "Swap_userAddress_idx" ON "Swap"("userAddress");

-- CreateIndex
CREATE INDEX "Swap_status_idx" ON "Swap"("status");

-- CreateIndex
CREATE INDEX "Swap_createdAt_idx" ON "Swap"("createdAt");

-- CreateIndex
CREATE INDEX "SwapStep_swapId_idx" ON "SwapStep"("swapId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_primaryAddress_idx" ON "User"("primaryAddress");

-- CreateIndex
CREATE INDEX "UserAddress_userId_idx" ON "UserAddress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAddress_chainType_address_key" ON "UserAddress"("chainType", "address");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "LimitOrder_userId_status_idx" ON "LimitOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "LimitOrder_status_expiresAt_idx" ON "LimitOrder"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "LimitOrder_fromTokenAddress_toTokenAddress_status_idx" ON "LimitOrder"("fromTokenAddress", "toTokenAddress", "status");

-- CreateIndex
CREATE INDEX "DCAStrategy_userId_status_idx" ON "DCAStrategy"("userId", "status");

-- CreateIndex
CREATE INDEX "DCAStrategy_status_nextExecutionAt_idx" ON "DCAStrategy"("status", "nextExecutionAt");

-- CreateIndex
CREATE INDEX "DCAExecution_strategyId_status_idx" ON "DCAExecution"("strategyId", "status");

-- CreateIndex
CREATE INDEX "DCAExecution_scheduledAt_status_idx" ON "DCAExecution"("scheduledAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_key" ON "Portfolio"("userId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_portfolioId_idx" ON "PortfolioHolding"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioHolding_portfolioId_chainId_tokenAddress_key" ON "PortfolioHolding"("portfolioId", "chainId", "tokenAddress");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_portfolioId_timestamp_idx" ON "PortfolioSnapshot"("portfolioId", "timestamp");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_status_idx" ON "PriceAlert"("userId", "status");

-- CreateIndex
CREATE INDEX "PriceAlert_status_tokenAddress_idx" ON "PriceAlert"("status", "tokenAddress");

-- CreateIndex
CREATE INDEX "AdSlot_isActive_sortOrder_idx" ON "AdSlot"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AdBooking_status_idx" ON "AdBooking"("status");

-- CreateIndex
CREATE INDEX "AdBooking_slotId_startDate_endDate_idx" ON "AdBooking"("slotId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "AdBooking_email_idx" ON "AdBooking"("email");

-- CreateIndex
CREATE INDEX "TokenListingRequest_status_idx" ON "TokenListingRequest"("status");

-- CreateIndex
CREATE INDEX "TokenListingRequest_email_idx" ON "TokenListingRequest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TokenListingRequest_chainId_contractAddress_key" ON "TokenListingRequest"("chainId", "contractAddress");

-- AddForeignKey
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAdmin" ADD CONSTRAINT "TenantAdmin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantApiKey" ADD CONSTRAINT "TenantApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantToken" ADD CONSTRAINT "TenantToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRevenue" ADD CONSTRAINT "TenantRevenue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swap" ADD CONSTRAINT "Swap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swap" ADD CONSTRAINT "Swap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapStep" ADD CONSTRAINT "SwapStep_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "Swap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LimitOrder" ADD CONSTRAINT "LimitOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LimitOrder" ADD CONSTRAINT "LimitOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCAStrategy" ADD CONSTRAINT "DCAStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCAStrategy" ADD CONSTRAINT "DCAStrategy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCAExecution" ADD CONSTRAINT "DCAExecution_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "DCAStrategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCAExecution" ADD CONSTRAINT "DCAExecution_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "Swap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBooking" ADD CONSTRAINT "AdBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AdSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
