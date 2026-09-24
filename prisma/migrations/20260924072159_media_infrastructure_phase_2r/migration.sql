-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaProvider" AS ENUM ('LOCAL', 'R2');

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "bucket" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "provider" "MediaProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "status" "MediaStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN     "upload_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Media_uploaded_by_id_idx" ON "Media"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "Media_status_idx" ON "Media"("status");

-- CreateIndex
CREATE INDEX "Media_mime_type_idx" ON "Media"("mime_type");

-- CreateIndex
CREATE INDEX "Media_created_at_idx" ON "Media"("created_at");
