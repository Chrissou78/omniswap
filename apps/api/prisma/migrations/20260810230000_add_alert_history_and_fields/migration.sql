-- AlterTable
ALTER TABLE "PriceAlert" ADD COLUMN     "priceAtCreation" DOUBLE PRECISION,
ADD COLUMN     "targetPercentChange" DOUBLE PRECISION,
ADD COLUMN     "tokenLogoURI" TEXT,
ADD COLUMN     "tokenName" TEXT,
ADD COLUMN     "triggerCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenLogoURI" TEXT,
    "chainId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "targetPercentChange" DOUBLE PRECISION,
    "triggeredPrice" DOUBLE PRECISION NOT NULL,
    "notificationsSent" TEXT[],
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertHistory_userId_triggeredAt_idx" ON "AlertHistory"("userId", "triggeredAt");

-- CreateIndex
CREATE INDEX "AlertHistory_alertId_idx" ON "AlertHistory"("alertId");

-- AddForeignKey
ALTER TABLE "AlertHistory" ADD CONSTRAINT "AlertHistory_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "PriceAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

