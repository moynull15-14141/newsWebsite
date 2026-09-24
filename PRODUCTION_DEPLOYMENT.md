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
| `MEDIA_STORAGE_PROVIDER` | `local` | `r2` | `r2` |
| `R2_PUBLIC_URL` | Local API media URL | Staging R2/CDN media URL | R2/CDN HTTPS media URL |
| `GOOGLE_NEWS_PUBLICATION_NAME` | `BD News` | Staging publication label | Verified publication name |
| `SEED_ADMIN_PASSWORD` | Optional demo value | Explicit secret if seeding | Explicit secret, never the demo password |

Never commit real secrets. Production startup rejects missing database/JWT/web configuration. Reader tokens currently live in the existing frontend auth store; use HTTPS and plan an httpOnly-cookie migration before a higher-security deployment model.

## Backend — Render
The repo root `render.yaml` is a Render Blueprint for the API service (`rootDir: .`, so it builds from
the monorepo root using the workspace tooling already in `package.json`/`turbo.json`):
1. In Render, "New +" → "Blueprint" → point at this repo. Render reads `render.yaml` and creates the
   `newssite-api` web service.
2. Build command (already in `render.yaml`): `npm install && npx turbo run build --filter=api` — installs
   the whole workspace, then builds `apps/api` and its workspace dependencies (`prisma generate` +
   `nest build`, via `apps/api`'s own `build` script).
3. Start command (already in `render.yaml`): `npm run start:prod --workspace=api` → `node dist/main`
   inside `apps/api`. It binds to Render's injected `PORT` (see `apps/api/src/main.ts`), not a hardcoded
   port.
4. Fill in the `sync: false` environment variables in the Render dashboard (Aiven `DATABASE_URL`, JWT
   secrets, `WEB_URL`/`API_URL`, `API_CORS_ORIGIN` set to the exact Vercel web + admin origins, R2
   credentials, `SEED_ADMIN_PASSWORD`). Never commit real values — `render.yaml` only carries variable
   *names* and non-secret defaults.
5. Health check path is `/api/v1/health` (already wired in `render.yaml`); Render uses it to gate
   deploys and restarts.
6. Run the migration once the service and database are both reachable: `npx prisma migrate deploy
   --schema prisma/schema.prisma` from a shell with the production `DATABASE_URL` (Render Shell, or a
   one-off local run against Aiven). See "Database Migration Safety" below — never `migrate dev`/`reset`/
   `db push` against production.
7. Verify `/api/v1/health`, `/api/v1/health/readiness` (DB connectivity), CORS from the deployed web/admin
   origins, request IDs, and R2-backed media URLs.

## Web and Admin — Vercel
`apps/web/vercel.json` and `apps/admin/vercel.json` each define the build for that app; create two
separate Vercel projects against this repo:
1. Per project, set **Root Directory** to `apps/web` (or `apps/admin`) in the Vercel dashboard. Vercel
   still installs from the repo root lockfile (npm workspaces monorepo), then runs the `buildCommand` in
   that app's `vercel.json`: `npx turbo run build --filter=web` (or `--filter=admin`), output directory
   `dist`.
2. Set `VITE_API_URL` (pointing at the deployed Render API, e.g. `https://newssite-api.onrender.com/api/v1`)
   as a Vercel Environment Variable for each project. Never set `DATABASE_URL`, `R2_*`, or `JWT_*` here —
   only `VITE_`-prefixed values are safe for browser code (see apps/web/src/lib/api.ts and
   apps/admin/src/lib/api.ts, which already read `VITE_API_URL`).
3. Each `vercel.json` includes a catch-all rewrite (`/(.*) → /index.html`) so client-side routing
   (React Router) works on hard refresh/deep links.
4. Once the Render API URL is known, add explicit Vercel rewrites (or DNS-level routing) so
   `/robots.txt`, `/sitemap.xml`, and `/news-sitemap.xml` on the web app's domain proxy to the API's
   `/api/v1/seo/*` endpoints — mirroring the dev-only proxy in `apps/web/vite.config.ts`, which does not
   apply to the static production build.
5. Keep admin on its own Vercel project/domain, separate from the public web app, and do not cache
   authenticated HTML/API responses (already enforced API-side via `Cache-Control: no-store` on
   `/auth/`, `/reader/`, `/admin`, `/articles` — see `apps/api/src/main.ts`).

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
