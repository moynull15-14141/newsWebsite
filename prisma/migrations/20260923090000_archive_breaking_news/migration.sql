ALTER TABLE "breaking_news" ADD COLUMN "archived_at" TIMESTAMP(3);

DROP INDEX "breaking_news_is_active_priority_idx";
CREATE INDEX "breaking_news_is_active_archived_at_priority_idx"
ON "breaking_news"("is_active", "archived_at", "priority");
