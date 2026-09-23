# Database Safety Policy

This document exists because of a real incident: on 2026-09-23, the production Aiven PostgreSQL
database was accidentally passed as `--shadow-database-url` to `prisma migrate diff`. Prisma resets
whatever database it is told is the "shadow" database in order to replay migration history against an
empty schema. Because the production connection string was used, all row data in the production
database was wiped (table structure survived; the `_prisma_migrations` tracking table and all row data
did not). See the incident report delivered to the project owner on that date for full detail.

**This must never happen again.** The rules below are not optional guidance — they are the reason this
file exists.

## Environment separation

| Variable | Purpose | Rule |
|---|---|---|
| `DATABASE_URL` | The application's real database (production Aiven, or a local dev Postgres) | Never pass this as a shadow/diff/reset target for any other environment |
| `SHADOW_DATABASE_URL` | Used only by `prisma migrate dev` / `prisma migrate diff` to compute schema diffs | Must be a separate, disposable database. Prisma **resets** it. Never set this to the same value as `DATABASE_URL` |
| `TEST_DATABASE_URL` | Automated test runs | Separate database, disposable |
| `STAGING_DATABASE_URL` | Pre-production verification | Separate database from production |

**`DATABASE_URL == SHADOW_DATABASE_URL` (or any other pairing above) is never a valid configuration.**
If you ever find yourself constructing a `--shadow-database-url` argument by reading `DATABASE_URL` out
of `.env`, stop — that is exactly the mistake this document exists to prevent.

## Commands allowed against PRODUCTION

- `prisma migrate deploy` — applies already-committed, already-reviewed migration files. Does not reset
  or diff anything. This is the only migration command that should ever run against the production
  `DATABASE_URL`.
- `prisma migrate status` — read-only.
- `prisma validate` — read-only, doesn't touch the database at all.
- Ordinary application queries via the generated Prisma Client (what the running API does).

## Commands that must NEVER target production `DATABASE_URL`

- `prisma migrate dev` — interactive, can reset the database it's pointed at.
- `prisma migrate reset` — explicitly drops and recreates the database.
- `prisma db push` — can drop columns/tables without a migration record.
- `prisma migrate diff --from-migrations ... --shadow-database-url <url>` — **resets whatever `<url>`
  points to.** This is precisely what caused the incident. `--shadow-database-url` must always be a
  disposable database, never production.
- Any raw `DROP` / `TRUNCATE` / unscoped `DELETE` / unscoped `UPDATE`.

If a migration needs a generated SQL diff for review (rather than `prisma migrate dev`'s interactive
flow), generate it by diffing two **schema files** (`--from-schema-datamodel <old.prisma>
--to-schema-datamodel <new.prisma>`), which needs no database connection at all, or by diffing against
a disposable local shadow database — never against `--from-migrations` combined with a shadow URL that
resolves to production.

## Environments

- **Production** — the real Aiven service. `migrate deploy` only. No shadow database is ever pointed
  here.
- **Development** — a local PostgreSQL instance (or a disposable dev branch of a managed service).
  `migrate dev` is fine here because the local shadow database Prisma manages automatically is also
  local and disposable.
- **Test** — an isolated `TEST_DATABASE_URL`, reset freely by test setup/teardown.
- **Shadow** — never a named, addressable environment of its own; it is a disposable scratch database
  Prisma creates/drops for diffing. It must never resolve to an environment anyone depends on.
- **Staging** — a separate database used to verify a migration/build before it reaches production.

## Production migration workflow

```
Write/modify prisma/schema.prisma locally
      ↓
prisma migrate dev  (against a LOCAL database only — never production)
      ↓
Review the generated migration SQL
      ↓
Run the full test suite against the local/dev database
      ↓
Deploy to staging; run `prisma migrate deploy` against STAGING_DATABASE_URL
      ↓
Verify the application against staging
      ↓
Only then: `prisma migrate deploy` against production DATABASE_URL
```

`prisma migrate deploy` never resets or diffs — it only applies migration files that are already
committed to git and have already been reviewed. That is what makes it safe for production, and why
every other Prisma command that can reset a database is disallowed there.

## Fail-fast validation

Where practical, tooling and scripts that accept more than one database URL as input should refuse to
run if two URLs are identical (see `scripts/restore-verify-postgres.ps1`, which already refuses to
restore into `DATABASE_URL`). Any new script that accepts a shadow/test/staging URL alongside
`DATABASE_URL` should add the same guard: compare the two and abort with a clear error if they match.

## Credentials

Never print, log, or commit a full connection string. Mask the password segment in any output
(`postgres://user:***@host:port/db`). Never send `DATABASE_URL` or any credential to an external
service. `.env` is git-ignored; keep it that way.
