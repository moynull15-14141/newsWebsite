-- CreateEnum
CREATE TYPE "HomepageSourceType" AS ENUM ('MANUAL', 'LATEST', 'CATEGORY', 'TAG', 'LOCATION');

-- AlterTable
ALTER TABLE "homepage_sections" ADD COLUMN     "card_variant" TEXT NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "source_type" "HomepageSourceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "tag_id" TEXT;

-- CreateIndex
CREATE INDEX "homepage_sections_tag_id_idx" ON "homepage_sections"("tag_id");

-- AddForeignKey
ALTER TABLE "homepage_sections" ADD CONSTRAINT "homepage_sections_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
