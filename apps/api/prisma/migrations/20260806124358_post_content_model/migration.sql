-- AlterTable
ALTER TABLE "post_targets" ADD COLUMN     "contentJsonOverride" JSONB,
ADD COLUMN     "contentOverride" TEXT,
ADD COLUMN     "firstCommentOverride" TEXT,
ADD COLUMN     "platformOptions" JSONB;

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "mediaAssetIds",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "contentJson" JSONB,
ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "firstComment" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_target_media" (
    "id" TEXT NOT NULL,
    "postTargetId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_target_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_media_postId_position_idx" ON "post_media"("postId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_postId_mediaAssetId_key" ON "post_media"("postId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "post_target_media_postTargetId_position_idx" ON "post_target_media"("postTargetId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "post_target_media_postTargetId_mediaAssetId_key" ON "post_target_media"("postTargetId", "mediaAssetId");

-- CreateIndex
CREATE INDEX "posts_workspaceId_deletedAt_status_updatedAt_idx" ON "posts"("workspaceId", "deletedAt", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_target_media" ADD CONSTRAINT "post_target_media_postTargetId_fkey" FOREIGN KEY ("postTargetId") REFERENCES "post_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_target_media" ADD CONSTRAINT "post_target_media_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

