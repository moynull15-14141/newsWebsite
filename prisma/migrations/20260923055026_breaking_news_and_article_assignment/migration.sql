-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "assignee_id" TEXT,
ADD COLUMN     "assignment_note" TEXT;

-- CreateTable
CREATE TABLE "breaking_news" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "article_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "background_mode" TEXT NOT NULL DEFAULT 'SOLID',
    "background_color" TEXT NOT NULL DEFAULT '#D32F2F',
    "gradient_start" TEXT,
    "gradient_end" TEXT,
    "gradient_direction" TEXT,
    "text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "badge_background_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "badge_text_color" TEXT NOT NULL DEFAULT '#D32F2F',
    "animation_speed_ms" INTEGER NOT NULL DEFAULT 18000,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breaking_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breaking_news_audit_logs" (
    "id" TEXT NOT NULL,
    "breaking_news_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breaking_news_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "breaking_news_is_active_priority_idx" ON "breaking_news"("is_active", "priority");

-- CreateIndex
CREATE INDEX "breaking_news_start_at_end_at_idx" ON "breaking_news"("start_at", "end_at");

-- CreateIndex
CREATE INDEX "breaking_news_article_id_idx" ON "breaking_news"("article_id");

-- CreateIndex
CREATE INDEX "breaking_news_audit_logs_breaking_news_id_created_at_idx" ON "breaking_news_audit_logs"("breaking_news_id", "created_at");

-- CreateIndex
CREATE INDEX "articles_assignee_id_idx" ON "articles"("assignee_id");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breaking_news_audit_logs" ADD CONSTRAINT "breaking_news_audit_logs_breaking_news_id_fkey" FOREIGN KEY ("breaking_news_id") REFERENCES "breaking_news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breaking_news_audit_logs" ADD CONSTRAINT "breaking_news_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
