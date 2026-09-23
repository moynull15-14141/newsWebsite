#!/usr/bin/env node
/**
 * Dedicated, explicit production system-data bootstrap.
 *
 * Runs prisma/seed.ts with NODE_ENV=production and SEED_SYSTEM_DATA_ONLY=true set ONLY for this
 * child process's environment — the developer's own shell/.env stays untouched (see
 * docs/DATABASE-SAFETY.md). Setting NODE_ENV=production here (rather than requiring it be set
 * globally) is what activates prisma/seed.ts's strong SEED_ADMIN_PASSWORD policy check, and
 * SEED_SYSTEM_DATA_ONLY=true skips every demo/sample article section in that file.
 *
 * Never logs DATABASE_URL, SEED_ADMIN_PASSWORD, or any other secret.
 */
const { spawnSync } = require('child_process');
const path = require('path');

console.log('Production system-data seed starting.');

const result = spawnSync(
  'npx',
  ['prisma', 'db', 'seed', '--schema', 'prisma/schema.prisma'],
  {
    stdio: 'inherit',
    shell: true, // resolves `npx` correctly as `npx.cmd` on Windows; every argument here is a static literal
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      SEED_SYSTEM_DATA_ONLY: 'true',
    },
  },
);

if (result.error) {
  console.error('Production system-data seed failed to start:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
