# Security Checklist

## Implemented
- [x] DTO whitelist validation with forbidden unknown fields.
- [x] JWT and refresh-token authentication with stored refresh-token hashes and revocation.
- [x] Server-side permission guards for CMS operations.
- [x] Reader/staff account separation.
- [x] Request ID response header.
- [x] `nosniff`, frame, referrer, permissions, and CSP report-only headers.
- [x] Sensitive-route in-process rate limiting.
- [x] Upload authorization, image MIME allowlist, 10 MB limit, Multer one-file limit, and MIME-derived storage extensions.
- [x] Production startup checks for critical configuration.
- [x] Production seed requires a strong explicit admin password, rejects demo passwords, and never logs credentials.
- [x] Production storage fails closed unless S3/R2 is configured; development may use local storage.
- [x] Sensitive article stats, revision, restore, schedule, and cancel-schedule operations require RBAC plus service-layer ownership checks.
- [x] Public comments are text content and moderation-controlled.

## Deployment Verification
- [ ] HTTPS and HSTS enabled at the edge.
- [ ] `API_CORS_ORIGIN` contains only exact HTTPS origins.
- [ ] CSP report-only violations reviewed, then enforcement enabled.
- [ ] Secrets stored and rotated through a provider secret manager.
- [ ] Database and object-storage backups enabled and restore-tested.
- [ ] CDN does not cache authenticated/private responses.
- [ ] WAF/bot controls configured for the deployment scale.

## Known Risks
- Access and refresh tokens are retained by the existing frontend store rather than httpOnly cookies.
- Rate limiting is process-local and does not coordinate across multiple API instances.
- S3/R2 requires provider credentials, bucket policy, versioning, and recovery configuration at deployment time.
- `npm audit` still reports Nest 10 transitive advisories whose fixes require a Nest major upgrade; this is an explicit dependency maintenance blocker, not suppressed.
- The available Nest security fix requires a compatibility-tested Nest 12 migration; `npm audit fix --force` was not used during P0.
