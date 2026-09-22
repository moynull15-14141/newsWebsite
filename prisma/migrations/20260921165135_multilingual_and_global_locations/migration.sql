-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LocationType" ADD VALUE 'CONTINENT';
ALTER TYPE "LocationType" ADD VALUE 'STATE';
ALTER TYPE "LocationType" ADD VALUE 'PROVINCE';
ALTER TYPE "LocationType" ADD VALUE 'REGION';
ALTER TYPE "LocationType" ADD VALUE 'COUNTY';
ALTER TYPE "LocationType" ADD VALUE 'CITY';
ALTER TYPE "LocationType" ADD VALUE 'MUNICIPALITY';
ALTER TYPE "LocationType" ADD VALUE 'SUBDISTRICT';
ALTER TYPE "LocationType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "language_id" TEXT,
ADD COLUMN     "translation_group_id" TEXT;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "languages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "native_name" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'ltr',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_translations" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_translations" (
    "id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_translation_groups" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_translation_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "languages_code_key" ON "languages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "location_translations_location_id_language_id_key" ON "location_translations"("location_id", "language_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_category_id_language_id_key" ON "category_translations"("category_id", "language_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_language_id_slug_key" ON "category_translations"("language_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tag_translations_tag_id_language_id_key" ON "tag_translations"("tag_id", "language_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_translations_language_id_slug_key" ON "tag_translations"("language_id", "slug");

-- CreateIndex
CREATE INDEX "articles_language_id_idx" ON "articles"("language_id");

-- CreateIndex
CREATE INDEX "articles_translation_group_id_idx" ON "articles"("translation_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "articles_translation_group_id_language_id_key" ON "articles"("translation_group_id", "language_id");

-- CreateIndex
CREATE INDEX "locations_country_code_idx" ON "locations"("country_code");

-- AddForeignKey
ALTER TABLE "location_translations" ADD CONSTRAINT "location_translations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_translations" ADD CONSTRAINT "location_translations_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_translations" ADD CONSTRAINT "tag_translations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_translations" ADD CONSTRAINT "tag_translations_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_translation_group_id_fkey" FOREIGN KEY ("translation_group_id") REFERENCES "article_translation_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

