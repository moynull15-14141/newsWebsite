/**
 * Pure header-set builder (Phase 2M) so the production header set is unit-testable without spinning up
 * the whole HTTP stack. Applied to every API response in main.ts.
 *
 * Note on scope: these headers protect the API's OWN responses (JSON, and any HTML it might ever serve
 * directly). They do NOT protect apps/web or apps/admin — a browser only enforces CSP/frame-ancestors
 * from the headers of the actual page it navigated to, and those SPAs are served by their own static
 * host, not this API. See docs/production-hardening.md for the headers that hosting layer needs.
 */
export function buildSecurityHeaders(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // This API only ever returns JSON (plus static image files under /media/files) — no inline
    // scripts/styles of its own to allow, so the policy can be this strict without breaking anything
    // it actually serves.
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  };
  if (isProduction) {
    // Only meaningful (and only safe to promise) once the API is actually served over HTTPS in
    // production — sending it in local http:// dev would just be a lie the browser ignores anyway,
    // but omitting it there avoids any confusion while reading response headers locally.
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}
