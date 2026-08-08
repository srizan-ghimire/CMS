-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PostTargetStatus" ADD VALUE 'RETRYING';
ALTER TYPE "PostTargetStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "PostTargetStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "post_targets" ADD COLUMN     "containerId" TEXT,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "payloadSnapshot" JSONB,
ADD COLUMN     "permalink" TEXT,
ADD COLUMN     "publishRound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "post_targets_idempotencyKey_key" ON "post_targets"("idempotencyKey");

-- CreateIndex
CREATE INDEX "post_targets_status_nextAttemptAt_idx" ON "post_targets"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "post_targets_status_scheduledFor_idx" ON "post_targets"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "post_targets_socialAccountId_status_idx" ON "post_targets"("socialAccountId", "status");

