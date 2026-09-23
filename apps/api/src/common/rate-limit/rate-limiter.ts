/**
 * Fixed-window rate limiter (Phase 2M). In-memory, one process's worth of counters — correct for this
 * project's current single-instance deployment; the moment the API runs behind a load balancer with
 * multiple instances, this needs a shared store (Redis) instead, since each instance would otherwise
 * count independently and the effective limit would multiply by instance count. Documented in
 * docs/production-hardening.md rather than solved here, since adding a Redis dependency the project
 * doesn't otherwise use would be exactly the "unnecessary infrastructure" Phase 2M warns against for a
 * single-instance deployment.
 */

export interface RateLimitRule {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  check(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { allowed: true, remaining: rule.max - 1, resetAt: now + rule.windowMs, limit: rule.max };
    }
    if (bucket.count >= rule.max) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt, limit: rule.max };
    }
    bucket.count += 1;
    return { allowed: true, remaining: Math.max(0, rule.max - bucket.count), resetAt: bucket.resetAt, limit: rule.max };
  }

  /** Drops expired buckets so a long-running process doesn't accumulate one entry per distinct
   * IP/key forever — called periodically, not on every request. */
  sweep(now = Date.now()) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  get size() {
    return this.buckets.size;
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Endpoint-appropriate tiers, not one global limit — a login attempt and a homepage fetch are
 * completely different risk/cost profiles. Every threshold is env-overridable so production can tune
 * limits without a code change (Phase 2M: "make limits configurable using environment variables").
 */
export const RATE_LIMIT_RULES = {
  // Brute-force login/reset protection — tight window, small ceiling.
  AUTH: { windowMs: envInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60_000), max: envInt('RATE_LIMIT_AUTH_MAX', 10) },
  // Search touches the DB with a non-trivial query — more expensive than a cached content read.
  SEARCH: { windowMs: envInt('RATE_LIMIT_SEARCH_WINDOW_MS', 60_000), max: envInt('RATE_LIMIT_SEARCH_MAX', 30) },
  // Unauthenticated writes (newsletter signup, view/analytics beacons, comments) — spam-prone, cheap to abuse.
  PUBLIC_WRITE: { windowMs: envInt('RATE_LIMIT_PUBLIC_WRITE_WINDOW_MS', 60_000), max: envInt('RATE_LIMIT_PUBLIC_WRITE_MAX', 10) },
  // Ordinary public content reads (homepage, articles, categories, breaking news) — cacheable, generous
  // ceiling so real readers and legitimate crawlers are never mistaken for abuse.
  PUBLIC_READ: { windowMs: envInt('RATE_LIMIT_PUBLIC_READ_WINDOW_MS', 60_000), max: envInt('RATE_LIMIT_PUBLIC_READ_MAX', 300) },
  // Authenticated admin/editorial mutations — keyed by user, not IP (see RateLimitGuard).
  MUTATION: { windowMs: envInt('RATE_LIMIT_MUTATION_WINDOW_MS', 60_000), max: envInt('RATE_LIMIT_MUTATION_MAX', 90) },
  // Media uploads — the most expensive admin action (storage I/O), tightest authenticated ceiling.
  UPLOAD: { windowMs: envInt('RATE_LIMIT_UPLOAD_WINDOW_MS', 10 * 60_000), max: envInt('RATE_LIMIT_UPLOAD_MAX', 20) },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitTier = keyof typeof RATE_LIMIT_RULES;

/**
 * Classifies an unauthenticated/pre-auth request path into a tier, or `null` for anything that
 * shouldn't be limited here (authenticated mutations are handled by RateLimitGuard instead, once the
 * user is known — see its own comment for why that can't happen in this same middleware).
 */
export function classifyPublicRoute(method: string, path: string): RateLimitTier | null {
  if (/\/auth\/(login|register|forgot-password|reset-password|refresh)\b/.test(path)) return 'AUTH';
  if (/\/public\/search\b/.test(path) || /[?&]search=/.test(path)) return 'SEARCH';
  if (method !== 'GET' && /\/public\/(newsletter|analytics\/events)\b|\/comments\b/.test(path)) return 'PUBLIC_WRITE';
  if (method === 'GET' && /\/public\/|\/seo\/|\/breaking-news-ticker\b/.test(path)) return 'PUBLIC_READ';
  return null;
}
