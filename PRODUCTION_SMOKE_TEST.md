# Production Smoke Test

Run after every production deployment and migration.

## Public
- [ ] Homepage returns 200 and renders headline/latest sections.
- [ ] Representative article returns 200 with title, canonical, JSON-LD, author, timestamp, and image/fallback.
- [ ] Category and district pages return content or a deliberate empty state.
- [ ] Search returns results and is `noindex`.
- [ ] `/robots.txt`, `/sitemap.xml`, and `/news-sitemap.xml` return valid content.
- [ ] PWA manifest and service worker load over HTTPS.

## Reader
- [ ] Registration and verification behavior is correct for the configured email mode.
- [ ] Login/logout works.
- [ ] Bookmark ownership is isolated between two readers.
- [ ] Notifications cannot be read by another reader.
- [ ] Expired/revoked sessions are rejected.

## Admin
- [ ] Staff login works.
- [ ] Article draft, review, schedule, publish, archive, and revision restore work with correct permissions.
- [ ] Media upload rejects non-image and oversized files.
- [ ] Comment moderation and reporting work.
- [ ] Ads and analytics dashboards load.
- [ ] Settings and homepage controls require their permissions.

## Infrastructure
- [ ] `/api/v1/health` returns 200.
- [ ] `/api/v1/health/readiness` returns 200 with database connected.
- [ ] Response includes `X-Request-Id` and expected security headers.
- [ ] Public responses have short cache policy; private responses are `no-store`.
- [ ] Storage upload, public media retrieval, and deletion are verified.
- [ ] Error logs can be correlated by request ID without secrets.

## Failure Checks
- [ ] Stop database in staging: readiness returns 503 and no connection details leak.
- [ ] Make storage unavailable: admin receives an error and public pages retain image fallback.
- [ ] Submit invalid/unauthorized requests: controlled 4xx responses.
- [ ] Confirm rate limiting on sensitive routes without blocking normal browsing.
