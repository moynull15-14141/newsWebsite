/**
 * Every `@Query('limit')`/`@Query('page')` controller parameter that isn't backed by a class-validator
 * DTO (most of them predate one, or take a single ad-hoc param rather than a full query object) was
 * parsing its raw string with nothing but `parseInt(..., 10)` — no upper bound at all, so
 * `?limit=999999` reached the database as-is (Phase 2M: "prevent ?pageSize=999999 or equivalent
 * abuse"). This is the one shared place that turns a raw query string into a safe, bounded integer,
 * used everywhere that isn't already going through a DTO with its own `@Max`.
 */
export function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/** The page number itself doesn't need a small ceiling the way `limit` does — an attacker requesting
 * page 50000 with limit=20 just gets an empty result cheaply (OFFSET is bounded by real row count in
 * practice) — but it still must be a sane positive integer, not NaN/negative/a huge string that could
 * misbehave in a raw SQL context. */
export function parsePage(raw: string | undefined): number {
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
