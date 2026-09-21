# Backup and Recovery

## Scope
This document separates application behavior from provider operations. The repository does not automate backups.

## PostgreSQL Plan
- The repository now provides `npm run db:backup`, which invokes `scripts/backup-postgres.ps1`, creates a verified custom-format `pg_dump`, and removes dumps older than the requested retention period.
- Schedule that command through the deployment host/CI scheduler; the repository does not run a background scheduler itself.
- Daily full managed snapshot or `pg_dump`.
- Point-in-time recovery enabled where the provider supports WAL archiving.
- Retain daily backups for 30 days and monthly backups for 12 months.
- Keep at least one encrypted copy in a separate account/region.
- Target RPO: 24 hours for daily-only backups; improve to 15 minutes with PITR.
- Target RTO: 4 hours for managed restore; validate with a timed drill.

## Restore Procedure
1. Stop writes or place the application in maintenance mode.
2. Restore into a new non-production database first.
3. Verify `npx prisma migrate status --schema prisma/schema.prisma`.
4. Apply pending migrations with `npx prisma migrate deploy`.
5. Check users, published articles, media metadata, comments, bookmarks, notifications, ads, and analytics.
6. Point a staging build at the restored database and run `PRODUCTION_SMOKE_TEST.md`.
7. For a provider-neutral executable check, run `npm run db:restore:verify -- -BackupFile <dump> -RestoreDatabaseUrl <isolated-url>`; it refuses to target the current `DATABASE_URL` and checks core tables/count queries.
8. Switch production only after integrity checks and approval.

Never run `prisma migrate reset` against production.

## Storage Plan
Use S3/R2 versioning or provider snapshots for the media bucket. Keep object keys immutable where possible, enable deletion recovery, and apply lifecycle rules only after confirming editorial retention requirements. Back up database media metadata and object storage together; either one alone is insufficient.

## Migration Recovery
A migration rollback is not assumed. Prefer forward-compatible application deployment and corrective migrations. Preserve the pre-deploy database snapshot until post-deploy verification completes.

## Restore Test Status
The restore verification executable is implemented, but no safe non-production restore target or provider backup credentials are configured in this repository. Deployment owners must run it against an isolated database and retain the output as launch evidence.
