# Production Deployment

## Environment Matrix

| Setting | Development | Staging | Production |
|---|---|---|---|
| `NODE_ENV` | `development` | `staging` | `production` |
| `DATABASE_URL` | Local PostgreSQL | Isolated managed PostgreSQL | Managed PostgreSQL with pooling/backups |
| `WEB_URL` | Local web URL | Staging HTTPS URL | Canonical HTTPS public URL |
| `API_URL` | Local API URL | Staging API URL | Public API URL |
| `API_CORS_ORIGIN` | Local web/admin URLs | Exact staging origins | Exact web/admin origins only |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Local non-shared values | Secret manager values | Secret manager values, rotated on schedule |
| `STORAGE_PROVIDER` | `local` | `s3`/R2-compatible | `s3`/R2-compatible |
| `S3_PUBLIC_BASE_URL` | Local API media URL | Staging CDN/media URL | CDN/media HTTPS URL |
| `GOOGLE_NEWS_PUBLICATION_NAME` | `BD News` | Staging publication label | Verified publication name |
| `SEED_ADMIN_PASSWORD` | Optional demo value | Explicit secret if seeding | Explicit secret, never the demo password |

Never commit real secrets. Production startup rejects missing database/JWT/web configuration. Reader tokens currently live in the existing frontend auth store; use HTTPS and plan an httpOnly-cookie migration before a higher-security deployment model.

## Backend
1. Provision PostgreSQL and versioned S3/R2-compatible object storage. `STORAGE_PROVIDER=s3` is now a real SDK-backed provider; missing required configuration fails startup.
2. Configure environment variables in a secret manager.
3. Run `npx prisma migrate deploy --schema prisma/schema.prisma`.
4. Build with `npm run build`.
5. Start with `npm --workspace api run start:prod`.
6. Verify `/api/v1/health`, `/api/v1/health/readiness`, CORS, request IDs, and storage.

## Web and Admin
1. Set `VITE_API_URL` at build time for each app.
2. Run `npm --workspace web run build` and `npm --workspace admin run build`.
3. Serve each `dist` directory over HTTPS.
4. Configure SPA fallback to `index.html` for client routes.
5. Keep admin on its own origin or path and do not cache authenticated HTML/API responses.

## CDN and Cache
- Cache Vite assets with `public, max-age=31536000, immutable` because filenames are content-hashed.
- Cache public SEO/feed responses briefly and purge after publishing.
- Cache public media by storage key; use versioned keys for replacements.
- Never publicly cache `/auth`, `/reader`, admin, bookmarks, notifications, analytics, or other authenticated responses.
- Proxy `/robots.txt`, `/sitemap.xml`, and `/news-sitemap.xml` to API SEO endpoints.

## Database Migration Safety
1. Create and verify a backup.
2. Run `npx prisma migrate deploy` against staging.
3. Run smoke tests.
4. Apply to production during a controlled window.
5. Deploy the application compatible with the new schema.
6. Verify health/readiness and public/admin smoke tests.

## Backup Commands
Run `npm run db:backup` on a host with `pg_dump` and `pg_restore`; schedule it externally and retain the verified dump off-host. Validate a dump with `npm run db:restore:verify -- -BackupFile <dump> -RestoreDatabaseUrl <isolated-url>`. Never pass the live `DATABASE_URL` as the restore target.

## Rollback
Application rollback is safe only when the previous build understands the current schema. Do not automatically roll back destructive migrations. Restore a database backup into a separate database, validate it, and use a forward migration or planned data repair. Purge CDN caches after application rollback and rotate secrets if compromise is suspected.

## Provider Tasks
Managed PostgreSQL backups, object-storage versioning, TLS certificates, CDN rules, WAF, alerting, email delivery, and centralized logs must be configured by the deployment provider. They are not claimed as repository automation.
