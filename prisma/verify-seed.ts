import { PrismaClient, LocationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [countries, divisions, districts, invalidDistricts, invalidDivisions] = await Promise.all([
    prisma.location.count({ where: { type: LocationType.COUNTRY } }),
    prisma.location.count({ where: { type: LocationType.DIVISION } }),
    prisma.location.count({ where: { type: LocationType.DISTRICT } }),
    prisma.location.count({ where: { type: LocationType.DISTRICT, parent: { type: { not: LocationType.DIVISION } } } }),
    prisma.location.count({ where: { type: LocationType.DIVISION, parent: { type: { not: LocationType.COUNTRY } } } }),
  ]);

  if (countries !== 1 || divisions !== 8 || districts !== 64 || invalidDistricts !== 0 || invalidDivisions !== 0) {
    throw new Error(`Location seed integrity failed: countries=${countries}, divisions=${divisions}, districts=${districts}, invalidDistricts=${invalidDistricts}, invalidDivisions=${invalidDivisions}`);
  }
  console.log(`Location seed verified: ${countries} country, ${divisions} divisions, ${districts} districts`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
