import { buildSecurityHeaders } from './security-headers';

describe('buildSecurityHeaders', () => {
  it('always sets the core hardening headers', () => {
    const headers = buildSecurityHeaders(false);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('never allows the API\'s own responses to run scripts or be framed', () => {
    const headers = buildSecurityHeaders(false);
    expect(headers['Content-Security-Policy']).toContain("script-src 'none'");
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('only sends HSTS in production — sending it over local http:// would be misleading', () => {
    expect(buildSecurityHeaders(false)['Strict-Transport-Security']).toBeUndefined();
    expect(buildSecurityHeaders(true)['Strict-Transport-Security']).toContain('max-age=');
  });
});
