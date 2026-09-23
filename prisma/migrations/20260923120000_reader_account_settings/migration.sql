ALTER TABLE "reader_profiles"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "profile_public" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "notification_preferences"
  ADD COLUMN "job_alerts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "account_security" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "reader_profiles_avatar_media_id_idx" ON "reader_profiles"("avatar_media_id");
ALTER TABLE "reader_profiles" ADD CONSTRAINT "reader_profiles_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
