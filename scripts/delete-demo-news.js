#!/usr/bin/env node
/**
 * Deletes every article created by scripts/seed-demo-news.js — identified by the "demo-content" tag AND
 * the "demo-" slug prefix (both, as a safety belt-and-braces check so this can never accidentally match
 * a real article that happens to share one signal but not the other).
 *
 * Does NOT touch the "Demo Content" tag row itself or any other data.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.article.findMany({
    where: {
      slug: { startsWith: 'demo-' },
      articleTags: { some: { tag: { slug: 'demo-content' } } },
    },
    select: { id: true, slug: true, title: true },
  });

  if (candidates.length === 0) {
    console.log('No demo articles found — nothing to delete.');
    return;
  }

  console.log(`Found ${candidates.length} demo articles to delete:`);
  for (const a of candidates) console.log(`  - ${a.slug}`);

  const result = await prisma.article.deleteMany({ where: { id: { in: candidates.map((a) => a.id) } } });
  console.log(`\nDeleted ${result.count} demo articles.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
