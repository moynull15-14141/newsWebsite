import { RateLimiter, classifyPublicRoute } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows requests up to the limit within the window', () => {
    const limiter = new RateLimiter();
    const rule = { windowMs: 60_000, max: 3 };
    const now = 1_000_000;
    expect(limiter.check('k', rule, now).allowed).toBe(true);
    expect(limiter.check('k', rule, now).allowed).toBe(true);
    expect(limiter.check('k', rule, now).allowed).toBe(true);
  });

  it('blocks the request that exceeds the limit within the same window', () => {
    const limiter = new RateLimiter();
    const rule = { windowMs: 60_000, max: 2 };
    const now = 1_000_000;
    limiter.check('k', rule, now);
    limiter.check('k', rule, now);
    const result = limiter.check('k', rule, now);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets the count once the window has elapsed', () => {
    const limiter = new RateLimiter();
    const rule = { windowMs: 60_000, max: 1 };
    const now = 1_000_000;
    expect(limiter.check('k', rule, now).allowed).toBe(true);
    expect(limiter.check('k', rule, now).allowed).toBe(false);
    expect(limiter.check('k', rule, now + 60_001).allowed).toBe(true);
  });

  it('tracks distinct keys independently — one IP hitting its limit never blocks another', () => {
    const limiter = new RateLimiter();
    const rule = { windowMs: 60_000, max: 1 };
    const now = 1_000_000;
    expect(limiter.check('ip-a', rule, now).allowed).toBe(true);
    expect(limiter.check('ip-b', rule, now).allowed).toBe(true);
    expect(limiter.check('ip-a', rule, now).allowed).toBe(false);
  });

  it('sweep removes only expired buckets, keeping live ones', () => {
    const limiter = new RateLimiter();
    const rule = { windowMs: 60_000, max: 5 };
    limiter.check('expired', rule, 0);
    limiter.check('live', rule, 1_000_000);
    limiter.sweep(1_000_000);
    expect(limiter.size).toBe(1);
  });
});

describe('classifyPublicRoute', () => {
  it('classifies login/register/password endpoints as AUTH', () => {
    expect(classifyPublicRoute('POST', '/api/v1/auth/login')).toBe('AUTH');
    expect(classifyPublicRoute('POST', '/api/v1/auth/forgot-password')).toBe('AUTH');
    expect(classifyPublicRoute('POST', '/api/v1/auth/refresh')).toBe('AUTH');
  });

  it('classifies search requests as SEARCH regardless of which endpoint carries the query', () => {
    expect(classifyPublicRoute('GET', '/api/v1/public/search')).toBe('SEARCH');
    expect(classifyPublicRoute('GET', '/api/v1/public/articles?search=flood')).toBe('SEARCH');
  });

  it('classifies unauthenticated write endpoints (newsletter, analytics beacon, comments) as PUBLIC_WRITE', () => {
    expect(classifyPublicRoute('POST', '/api/v1/public/newsletter/subscribe')).toBe('PUBLIC_WRITE');
    expect(classifyPublicRoute('POST', '/api/v1/public/analytics/events')).toBe('PUBLIC_WRITE');
    expect(classifyPublicRoute('POST', '/api/v1/comments')).toBe('PUBLIC_WRITE');
  });

  it('classifies ordinary public GET content as PUBLIC_READ', () => {
    expect(classifyPublicRoute('GET', '/api/v1/public/homepage')).toBe('PUBLIC_READ');
    expect(classifyPublicRoute('GET', '/api/v1/public/breaking-news-ticker')).toBe('PUBLIC_READ');
    expect(classifyPublicRoute('GET', '/api/v1/seo/sitemap.xml')).toBe('PUBLIC_READ');
  });

  it('does not classify authenticated admin routes — those are rate-limited by user via RateLimitGuard instead', () => {
    expect(classifyPublicRoute('PATCH', '/api/v1/articles/abc123')).toBeNull();
    expect(classifyPublicRoute('GET', '/api/v1/articles')).toBeNull();
  });
});
