import { HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

function makeContext(overrides: { method?: string; user?: { userId: string }; originalUrl?: string }) {
  const request = { method: overrides.method ?? 'POST', user: overrides.user, originalUrl: overrides.originalUrl ?? '/api/v1/articles' };
  const response = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as any;
}

describe('RateLimitGuard', () => {
  it('never limits GET/HEAD requests', () => {
    const guard = new RateLimitGuard();
    expect(guard.canActivate(makeContext({ method: 'GET', user: { userId: 'u1' } }))).toBe(true);
    expect(guard.canActivate(makeContext({ method: 'HEAD', user: { userId: 'u1' } }))).toBe(true);
  });

  it('lets an unauthenticated write pass through — that is the public middleware\'s job, not this guard\'s', () => {
    const guard = new RateLimitGuard();
    expect(guard.canActivate(makeContext({ method: 'POST', user: undefined }))).toBe(true);
  });

  it('throws 429 once an authenticated user exceeds the mutation ceiling', () => {
    const guard = new RateLimitGuard();
    const ctx = () => makeContext({ method: 'POST', user: { userId: 'u1' }, originalUrl: '/api/v1/articles' });
    for (let i = 0; i < 90; i += 1) expect(guard.canActivate(ctx())).toBe(true);
    expect(() => guard.canActivate(ctx())).toThrow(HttpException);
  });

  it('tracks two different users independently — one user hitting the limit never blocks another', () => {
    const guard = new RateLimitGuard();
    for (let i = 0; i < 90; i += 1) guard.canActivate(makeContext({ method: 'POST', user: { userId: 'u1' } }));
    expect(() => guard.canActivate(makeContext({ method: 'POST', user: { userId: 'u1' } }))).toThrow(HttpException);
    expect(guard.canActivate(makeContext({ method: 'POST', user: { userId: 'u2' } }))).toBe(true);
  });

  it('applies the tighter upload ceiling for POST /media specifically, separate from general mutations', () => {
    const guard = new RateLimitGuard();
    for (let i = 0; i < 20; i += 1) {
      expect(guard.canActivate(makeContext({ method: 'POST', user: { userId: 'u1' }, originalUrl: '/api/v1/media' }))).toBe(true);
    }
    expect(() => guard.canActivate(makeContext({ method: 'POST', user: { userId: 'u1' }, originalUrl: '/api/v1/media' }))).toThrow(HttpException);
  });

  it('sets X-RateLimit-* response headers', () => {
    const guard = new RateLimitGuard();
    const request = { method: 'POST', user: { userId: 'u1' }, originalUrl: '/api/v1/articles' };
    const response = { setHeader: jest.fn() };
    const ctx = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as any;
    guard.canActivate(ctx);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
  });
});
