-- Replace globally unique location slugs with hierarchy-aware identities.
ALTER TABLE "locations" ADD COLUMN "identity_key" TEXT;

UPDATE "locations"
SET "identity_key" = "type"::text || ':' || COALESCE("parent_id", 'root') || ':' || "slug";

ALTER TABLE "locations" ALTER COLUMN "identity_key" SET NOT NULL;
ALTER TABLE "locations" DROP CONSTRAINT IF EXISTS "locations_slug_key";
CREATE UNIQUE INDEX "locations_identity_key_key" ON "locations"("identity_key");
CREATE UNIQUE INDEX "locations_type_parent_id_slug_key" ON "locations"("type", "parent_id", "slug");
