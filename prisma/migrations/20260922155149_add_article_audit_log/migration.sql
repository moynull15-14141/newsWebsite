-- CreateTable
CREATE TABLE "article_audit_logs" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_audit_logs_article_id_created_at_idx" ON "article_audit_logs"("article_id", "created_at");

-- AddForeignKey
ALTER TABLE "article_audit_logs" ADD CONSTRAINT "article_audit_logs_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_audit_logs" ADD CONSTRAINT "article_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
