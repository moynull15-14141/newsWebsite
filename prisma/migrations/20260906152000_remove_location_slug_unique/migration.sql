-- The original global slug uniqueness was an index, not a constraint.
DROP INDEX IF EXISTS "locations_slug_key";
