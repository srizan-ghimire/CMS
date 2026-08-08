-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SnippetKind" AS ENUM ('TEXT', 'HASHTAG_GROUP', 'CTA', 'SIGNATURE');

-- AlterTable
ALTER TABLE "media_assets" DROP COLUMN "tags";

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "createdFromTemplateId" TEXT;

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "media_asset_tags" (
    "mediaAssetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "media_asset_tags_pkey" PRIMARY KEY ("mediaAssetId","tagId")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "goal" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'PLANNING',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "contentJson" JSONB,
    "variables" TEXT[],
    "defaultPlatforms" "SocialPlatform"[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "post_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snippets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SnippetKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tags_workspaceId_idx" ON "tags"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_workspaceId_slug_key" ON "tags"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "post_tags_tagId_idx" ON "post_tags"("tagId");

-- CreateIndex
CREATE INDEX "media_asset_tags_tagId_idx" ON "media_asset_tags"("tagId");

-- CreateIndex
CREATE INDEX "campaigns_workspaceId_status_idx" ON "campaigns"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_workspaceId_name_key" ON "campaigns"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "post_templates_workspaceId_idx" ON "post_templates"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "post_templates_workspaceId_name_key" ON "post_templates"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "snippets_workspaceId_kind_idx" ON "snippets"("workspaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "snippets_workspaceId_name_key" ON "snippets"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "posts_campaignId_idx" ON "posts"("campaignId");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_createdFromTemplateId_fkey" FOREIGN KEY ("createdFromTemplateId") REFERENCES "post_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_templates" ADD CONSTRAINT "post_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_templates" ADD CONSTRAINT "post_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Full-text search (hand-written: Prisma cannot express any of this)
--
-- `@@fulltext` in schema.prisma is MySQL-only, so the tsvector columns are declared there as
-- Unsupported("tsvector") purely to stop `migrate` from dropping them, and created properly here.
--
-- GENERATED ... STORED (Postgres 12+; docker-compose runs 16) means the vector is maintained by
-- the database itself: no trigger to install, no application write path, and therefore no way for
-- it to drift out of sync with the row.
--
-- IMPORTANT: tags deliberately are NOT part of these vectors. Tags live in a join table, and a
-- generated column may only reference columns of its own row. Tag filtering is an EXISTS join in
-- SearchService — do not "fix" this by trying to inline tags here; it cannot work.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "posts" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')),   'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ("searchVector");

ALTER TABLE "media_assets" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("fileName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("altText",  '')), 'B') ||
    setweight(to_tsvector('english', coalesce("caption",  '')), 'C')
  ) STORED;

CREATE INDEX "media_assets_search_vector_idx" ON "media_assets" USING GIN ("searchVector");

-- Trigram index for fuzzy filename matching ("logo_v2" should find "logo-v2-final").
CREATE INDEX "media_assets_filename_trgm_idx" ON "media_assets" USING GIN ("fileName" gin_trgm_ops);
