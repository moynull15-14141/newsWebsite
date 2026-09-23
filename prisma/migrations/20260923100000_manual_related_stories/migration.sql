CREATE TABLE "article_related" (
  "article_id" TEXT NOT NULL,
  "related_article_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_related_pkey" PRIMARY KEY ("article_id", "related_article_id")
);

CREATE UNIQUE INDEX "article_related_article_id_position_key" ON "article_related"("article_id", "position");
CREATE INDEX "article_related_related_article_id_idx" ON "article_related"("related_article_id");
ALTER TABLE "article_related" ADD CONSTRAINT "article_related_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "article_related" ADD CONSTRAINT "article_related_related_article_id_fkey" FOREIGN KEY ("related_article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
