-- Homepage configuration boundary (Phase 2A Step 03B1).
--
-- Invariant: exactly one row per HomepageConfigurationStatus. The single ACTIVE row is the live
-- homepage, the single DRAFT row is the isolated working copy. The unique index on "status"
-- makes an ambiguous "two active configurations" state impossible at the database level.
--
-- Existing HomepageSection / HomepagePlacement rows are PRESERVED (never deleted or recreated):
--   * published sections  -> ACTIVE configuration (same row ids, same articles)
--   * unpublished sections -> DRAFT configuration (they were never public)
--   * the ACTIVE configuration is then cloned into the DRAFT so editing can begin immediately.

-- CreateEnum
CREATE TYPE "HomepageConfigurationStatus" AS ENUM ('ACTIVE', 'DRAFT');

-- CreateTable
CREATE TABLE "homepage_configurations" (
    "id" TEXT NOT NULL,
    "status" "HomepageConfigurationStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "homepage_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "homepage_configurations_status_key" ON "homepage_configurations"("status");

INSERT INTO "homepage_configurations" ("id", "status", "version", "published_at")
VALUES
  ('homepage-active', 'ACTIVE', 1, CURRENT_TIMESTAMP),
  ('homepage-draft', 'DRAFT', 1, NULL);

-- Section identity: "key" is unique per configuration. Singleton types (everything except CUSTOM)
-- use lower(type) so the public contract stays keyed exactly as before. CUSTOM sections, and any
-- pre-existing duplicate of a singleton type, get type-<id> so every legacy row stays addressable;
-- the service rejects duplicate singletons at publish time.
ALTER TABLE "homepage_sections" ADD COLUMN "configuration_id" TEXT;
ALTER TABLE "homepage_sections" ADD COLUMN "key" TEXT;

WITH ranked AS (
  SELECT "id", "type",
         row_number() OVER (PARTITION BY "type" ORDER BY "published" DESC, "sort_order", "id") AS type_rank
  FROM "homepage_sections"
)
UPDATE "homepage_sections" AS section
SET "configuration_id" = CASE WHEN section."published" THEN 'homepage-active' ELSE 'homepage-draft' END,
    "key" = CASE
      WHEN ranked."type" = 'CUSTOM' OR ranked.type_rank > 1 THEN lower(ranked."type"::text) || '-' || section."id"
      ELSE lower(ranked."type"::text)
    END
FROM ranked
WHERE ranked."id" = section."id";

-- Normalize ordering deterministically. Legacy data contains duplicate sort_order values
-- (ties were previously broken arbitrarily by the database); ties now break by id.
-- Placements: 0..n-1 per section.
WITH ordered AS (
  SELECT "section_id", "article_id",
         row_number() OVER (PARTITION BY "section_id" ORDER BY "sort_order", "article_id") - 1 AS new_order
  FROM "homepage_placements"
)
UPDATE "homepage_placements" AS placement
SET "sort_order" = ordered.new_order
FROM ordered
WHERE ordered."section_id" = placement."section_id" AND ordered."article_id" = placement."article_id";

-- Sections: 0..n-1 per configuration, and map the legacy free-text layout ("GRID") onto the
-- validated presets. Step 02 alternated "featured + stack" / "three-up" by visible position, so the
-- migration reproduces that exact alternation to keep the rendered homepage unchanged.
WITH ordered AS (
  SELECT s."id", s."configuration_id",
         row_number() OVER (PARTITION BY s."configuration_id" ORDER BY s."sort_order", s."id") - 1 AS new_order,
         (s."enabled" AND s."type" <> 'HERO'
           AND EXISTS (SELECT 1 FROM "homepage_placements" p WHERE p."section_id" = s."id")) AS shown
  FROM "homepage_sections" s
), shown_rank AS (
  SELECT "id", row_number() OVER (PARTITION BY "configuration_id" ORDER BY new_order) - 1 AS shown_index
  FROM ordered
  WHERE shown
)
UPDATE "homepage_sections" AS section
SET "sort_order" = ordered.new_order,
    "layout_type" = CASE WHEN shown_rank.shown_index % 2 = 1 THEN 'THREE_UP' ELSE 'FEATURED_STACK' END
FROM ordered
LEFT JOIN shown_rank ON shown_rank."id" = ordered."id"
WHERE ordered."id" = section."id";

-- Clone the ACTIVE configuration into the isolated DRAFT (new section ids, same content).
INSERT INTO "homepage_sections" (
  "id", "configuration_id", "type", "key", "title", "enabled", "sort_order",
  "category_id", "location_id", "max_items", "layout_type", "published", "updated_at"
)
SELECT
  gen_random_uuid()::text, 'homepage-draft', "type", "key", "title", "enabled", "sort_order",
  "category_id", "location_id", "max_items", "layout_type", false, CURRENT_TIMESTAMP
FROM "homepage_sections"
WHERE "configuration_id" = 'homepage-active';

INSERT INTO "homepage_placements" ("section_id", "article_id", "sort_order")
SELECT draft."id", placement."article_id", placement."sort_order"
FROM "homepage_sections" active
JOIN "homepage_sections" draft
  ON draft."configuration_id" = 'homepage-draft' AND draft."key" = active."key"
JOIN "homepage_placements" placement ON placement."section_id" = active."id"
WHERE active."configuration_id" = 'homepage-active';

-- Only relevant if pre-existing unpublished rows were merged into the DRAFT: re-pack its order.
WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "sort_order", "id") - 1 AS new_order
  FROM "homepage_sections"
  WHERE "configuration_id" = 'homepage-draft'
)
UPDATE "homepage_sections" AS section
SET "sort_order" = ordered.new_order
FROM ordered
WHERE ordered."id" = section."id" AND section."sort_order" <> ordered.new_order;

ALTER TABLE "homepage_sections" ALTER COLUMN "configuration_id" SET NOT NULL;
ALTER TABLE "homepage_sections" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "homepage_sections" ALTER COLUMN "layout_type" SET DEFAULT 'FEATURED_STACK';

-- "published" is superseded by the configuration boundary (ACTIVE == published).
ALTER TABLE "homepage_sections" DROP COLUMN "published";

CREATE INDEX "homepage_sections_configuration_id_sort_order_idx" ON "homepage_sections"("configuration_id", "sort_order");
CREATE UNIQUE INDEX "homepage_sections_configuration_id_key_key" ON "homepage_sections"("configuration_id", "key");

ALTER TABLE "homepage_sections"
ADD CONSTRAINT "homepage_sections_configuration_id_fkey"
FOREIGN KEY ("configuration_id") REFERENCES "homepage_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
