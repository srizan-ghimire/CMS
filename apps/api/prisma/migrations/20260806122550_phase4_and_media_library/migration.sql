-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "altText" TEXT,
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADING',
ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "uploadedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "media_folders" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "path" TEXT NOT NULL DEFAULT '/',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN     "lastErrorMessage" TEXT,
ADD COLUMN     "lastValidatedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "redirectPath" TEXT NOT NULL DEFAULT '/settings/connections',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_expiresAt_idx" ON "oauth_states"("expiresAt");

-- CreateIndex
CREATE INDEX "media_variants_mediaAssetId_idx" ON "media_variants"("mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_mediaAssetId_label_key" ON "media_variants"("mediaAssetId", "label");

-- CreateIndex
CREATE INDEX "media_assets_workspaceId_deletedAt_type_createdAt_idx" ON "media_assets"("workspaceId", "deletedAt", "type", "createdAt");

-- CreateIndex
CREATE INDEX "media_assets_workspaceId_status_idx" ON "media_assets"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_workspaceId_checksum_key" ON "media_assets"("workspaceId", "checksum");

-- CreateIndex
CREATE INDEX "media_folders_workspaceId_path_idx" ON "media_folders"("workspaceId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "media_folders_workspaceId_parentId_name_key" ON "media_folders"("workspaceId", "parentId", "name");

-- CreateIndex
CREATE INDEX "social_accounts_status_tokenExpiresAt_idx" ON "social_accounts"("status", "tokenExpiresAt");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

