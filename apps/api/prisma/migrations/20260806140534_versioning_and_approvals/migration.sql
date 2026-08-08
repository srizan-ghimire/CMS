-- DropIndex
DROP INDEX "post_versions_postId_idx";

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "mentionedUserIds" TEXT[],
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable

-- AlterTable
ALTER TABLE "post_approvals" ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "post_versions" DROP COLUMN "editedBy",
ADD COLUMN     "changeSummary" TEXT,
ADD COLUMN     "contentJson" JSONB,
ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "snapshot" JSONB NOT NULL,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "versionNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "approvalRound" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
    "approverRoles" "WorkspaceRole"[],
    "allowAuthorSelfApprove" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_policies_workspaceId_key" ON "approval_policies"("workspaceId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "post_approvals_reviewerId_status_idx" ON "post_approvals"("reviewerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "post_approvals_postId_reviewerId_round_key" ON "post_approvals"("postId", "reviewerId", "round");

-- CreateIndex
CREATE INDEX "post_versions_postId_versionNumber_idx" ON "post_versions"("postId", "versionNumber" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "post_versions_postId_versionNumber_key" ON "post_versions"("postId", "versionNumber");

-- AddForeignKey
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_approvals" ADD CONSTRAINT "post_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

