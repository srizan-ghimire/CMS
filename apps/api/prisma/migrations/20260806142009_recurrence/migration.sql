-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "recurrenceCount" INTEGER,
ADD COLUMN     "recurrenceEndsAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceParentId" TEXT;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_recurrenceParentId_fkey" FOREIGN KEY ("recurrenceParentId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

