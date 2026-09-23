import { formatRequestLog, sanitizePathForLogging } from './request-logger';

describe('formatRequestLog', () => {
  it('includes the fields Phase 2M asks for: timestamp, request id, endpoint, method, status, duration', () => {
    const line = formatRequestLog({ requestId: 'r1', method: 'GET', path: '/api/v1/articles', statusCode: 200, durationMs: 42 });
    expect(line).toContain('requestId=r1');
    expect(line).toContain('method=GET');
    expect(line).toContain('path=/api/v1/articles');
    expect(line).toContain('status=200');
    expect(line).toContain('durationMs=42');
    expect(line).toMatch(/time=\d{4}-\d{2}-\d{2}T/);
  });

  it('includes the actor id when a request was authenticated', () => {
    expect(formatRequestLog({ requestId: 'r1', method: 'POST', path: '/api/v1/articles', statusCode: 201, durationMs: 5, actorId: 'user-1' })).toContain('actorId=user-1');
  });

  it('omits actorId entirely for unauthenticated requests, rather than logging "actorId=undefined"', () => {
    const line = formatRequestLog({ requestId: 'r1', method: 'GET', path: '/', statusCode: 200, durationMs: 1 });
    expect(line).not.toContain('actorId=');
  });
});

describe('sanitizePathForLogging', () => {
  it('strips the query string, which can carry a password-reset token or search text', () => {
    expect(sanitizePathForLogging('/api/v1/auth/reset-password?token=abc123')).toBe('/api/v1/auth/reset-password');
    expect(sanitizePathForLogging('/api/v1/public/search?q=flood+relief')).toBe('/api/v1/public/search');
  });

  it('leaves a path with no query string unchanged', () => {
    expect(sanitizePathForLogging('/api/v1/articles')).toBe('/api/v1/articles');
  });
});
