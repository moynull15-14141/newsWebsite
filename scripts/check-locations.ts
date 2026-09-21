import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
async function main() {
  const byType = await p.location.groupBy({ by: ['type'], _count: true });
  console.log('locations by type:', byType);
  const arts = await p.article.count({ where: { locationId: { not: null } } });
  console.log('articles with location:', arts);
  const bangladesh = await p.location.findFirst({ where: { slug: 'bangladesh' } });
  console.log('bangladesh country row:', bangladesh);
}
main().finally(() => p.$disconnect());
