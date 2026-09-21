-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "canonical_url" TEXT,
ADD COLUMN     "no_index" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seo_description" TEXT,
ADD COLUMN     "seo_keywords" TEXT,
ADD COLUMN     "seo_title" TEXT;
