// P0-02: Bangladesh location seed dataset and integrity verification.
// Kept separate from prisma/seed.ts so the dataset and the invariants are
// unit-testable without a database connection.
import { LocationType } from '@prisma/client';

export interface SeedDivision {
  name: string;
  slug: string;
}

export interface SeedDistrict {
  name: string;
  slug: string;
  division: string; // division slug
}

export const BANGLADESH_DIVISIONS: SeedDivision[] = [
  { name: 'Barisal', slug: 'barisal' },
  { name: 'Chattogram', slug: 'chattogram' },
  { name: 'Dhaka', slug: 'dhaka' },
  { name: 'Khulna', slug: 'khulna' },
  { name: 'Mymensingh', slug: 'mymensingh' },
  { name: 'Rajshahi', slug: 'rajshahi' },
  { name: 'Rangpur', slug: 'rangpur' },
  { name: 'Sylhet', slug: 'sylhet' },
];

export const BANGLADESH_DISTRICTS: SeedDistrict[] = [
  // Barisal Division (6)
  { name: 'Barguna', slug: 'barguna', division: 'barisal' },
  { name: 'Barisal', slug: 'barisal', division: 'barisal' },
  { name: 'Bhola', slug: 'bhola', division: 'barisal' },
  { name: 'Jhalokathi', slug: 'jhalokathi', division: 'barisal' },
  { name: 'Patuakhali', slug: 'patuakhali', division: 'barisal' },
  { name: 'Pirojpur', slug: 'pirojpur', division: 'barisal' },

  // Chattogram Division (11)
  { name: 'Bandarban', slug: 'bandarban', division: 'chattogram' },
  { name: 'Brahmanbaria', slug: 'brahmanbaria', division: 'chattogram' },
  { name: 'Chandpur', slug: 'chandpur', division: 'chattogram' },
  { name: 'Chattogram', slug: 'chattogram', division: 'chattogram' },
  { name: 'Comilla', slug: 'comilla', division: 'chattogram' },
  { name: "Cox's Bazar", slug: 'coxs-bazar', division: 'chattogram' },
  { name: 'Feni', slug: 'feni', division: 'chattogram' },
  { name: 'Khagrachhari', slug: 'khagrachhari', division: 'chattogram' },
  { name: 'Lakshmipur', slug: 'lakshmipur', division: 'chattogram' },
  { name: 'Noakhali', slug: 'noakhali', division: 'chattogram' },
  { name: 'Rangamati', slug: 'rangamati', division: 'chattogram' },

  // Dhaka Division (13)
  { name: 'Dhaka', slug: 'dhaka', division: 'dhaka' },
  { name: 'Faridpur', slug: 'faridpur', division: 'dhaka' },
  { name: 'Gazipur', slug: 'gazipur', division: 'dhaka' },
  { name: 'Gopalganj', slug: 'gopalganj', division: 'dhaka' },
  { name: 'Kishoreganj', slug: 'kishoreganj', division: 'dhaka' },
  { name: 'Madaripur', slug: 'madaripur', division: 'dhaka' },
  { name: 'Manikganj', slug: 'manikganj', division: 'dhaka' },
  { name: 'Munshiganj', slug: 'munshiganj', division: 'dhaka' },
  { name: 'Narayanganj', slug: 'narayanganj', division: 'dhaka' },
  { name: 'Narsingdi', slug: 'narsingdi', division: 'dhaka' },
  { name: 'Rajbari', slug: 'rajbari', division: 'dhaka' },
  { name: 'Shariatpur', slug: 'shariatpur', division: 'dhaka' },
  { name: 'Tangail', slug: 'tangail', division: 'dhaka' },

  // Khulna Division (10)
  { name: 'Bagerhat', slug: 'bagerhat', division: 'khulna' },
  { name: 'Chuadanga', slug: 'chuadanga', division: 'khulna' },
  { name: 'Jessore', slug: 'jessore', division: 'khulna' },
  { name: 'Jhenaidah', slug: 'jhenaidah', division: 'khulna' },
  { name: 'Khulna', slug: 'khulna', division: 'khulna' },
  { name: 'Kushtia', slug: 'kushtia', division: 'khulna' },
  { name: 'Magura', slug: 'magura', division: 'khulna' },
  { name: 'Meherpur', slug: 'meherpur', division: 'khulna' },
  { name: 'Narail', slug: 'narail', division: 'khulna' },
  { name: 'Satkhira', slug: 'satkhira', division: 'khulna' },

  // Mymensingh Division (4)
  { name: 'Jamalpur', slug: 'jamalpur', division: 'mymensingh' },
  { name: 'Mymensingh', slug: 'mymensingh', division: 'mymensingh' },
  { name: 'Netrokona', slug: 'netrokona', division: 'mymensingh' },
  { name: 'Sherpur', slug: 'sherpur', division: 'mymensingh' },

  // Rajshahi Division (8)
  { name: 'Bogra', slug: 'bogra', division: 'rajshahi' },
  { name: 'Chapai Nawabganj', slug: 'chapai-nawabganj', division: 'rajshahi' },
  { name: 'Joypurhat', slug: 'joypurhat', division: 'rajshahi' },
  { name: 'Naogaon', slug: 'naogaon', division: 'rajshahi' },
  { name: 'Natore', slug: 'natore', division: 'rajshahi' },
  { name: 'Pabna', slug: 'pabna', division: 'rajshahi' },
  { name: 'Rajshahi', slug: 'rajshahi', division: 'rajshahi' },
  { name: 'Sirajganj', slug: 'sirajganj', division: 'rajshahi' },

  // Rangpur Division (8)
  { name: 'Dinajpur', slug: 'dinajpur', division: 'rangpur' },
  { name: 'Gaibandha', slug: 'gaibandha', division: 'rangpur' },
  { name: 'Kurigram', slug: 'kurigram', division: 'rangpur' },
  { name: 'Lalmonirhat', slug: 'lalmonirhat', division: 'rangpur' },
  { name: 'Nilphamari', slug: 'nilphamari', division: 'rangpur' },
  { name: 'Panchagarh', slug: 'panchagarh', division: 'rangpur' },
  { name: 'Rangpur', slug: 'rangpur', division: 'rangpur' },
  { name: 'Thakurgaon', slug: 'thakurgaon', division: 'rangpur' },

  // Sylhet Division (4)
  { name: 'Habiganj', slug: 'habiganj', division: 'sylhet' },
  { name: 'Moulvibazar', slug: 'moulvibazar', division: 'sylhet' },
  { name: 'Sunamganj', slug: 'sunamganj', division: 'sylhet' },
  { name: 'Sylhet', slug: 'sylhet', division: 'sylhet' },
];

export const EXPECTED_DIVISION_COUNT = 8;
export const EXPECTED_DISTRICT_COUNT = 64;

export interface SeedLocationRow {
  id: string;
  name: string;
  slug: string;
  type: LocationType;
  parentId: string | null;
}

/**
 * Verifies the seeded Bangladesh location hierarchy:
 *  - exactly 1 Bangladesh country record (other COUNTRY rows may legitimately exist — Phase 2C adds a
 *    global hierarchy of continents/countries alongside Bangladesh, in the same `locations` table)
 *  - exactly 8 divisions
 *  - exactly 64 districts
 *  - every district's parent is a valid division
 *  - a same-named district/division pair is always two DISTINCT records
 *  - district (type, parent, slug) identities are unique
 * Throws with a generic, data-safe message on any violation.
 */
export function verifyLocationSeedIntegrity(locations: SeedLocationRow[]): void {
  const countries = locations.filter((l) => l.type === LocationType.COUNTRY);
  const divisions = locations.filter((l) => l.type === LocationType.DIVISION);
  const districts = locations.filter((l) => l.type === LocationType.DISTRICT);

  const bangladeshCountries = countries.filter((c) => c.slug === 'bangladesh');
  if (bangladeshCountries.length !== 1) {
    throw new Error('Location seed integrity failure: expected exactly one Bangladesh country record');
  }
  if (divisions.length !== EXPECTED_DIVISION_COUNT) {
    throw new Error(`Location seed integrity failure: expected ${EXPECTED_DIVISION_COUNT} divisions, found ${divisions.length}`);
  }
  if (districts.length !== EXPECTED_DISTRICT_COUNT) {
    throw new Error(`Location seed integrity failure: expected ${EXPECTED_DISTRICT_COUNT} districts, found ${districts.length}`);
  }

  const divisionBySlug = new Map(divisions.map((d) => [d.slug, d]));

  for (const district of districts) {
    const parent = district.parentId ? locations.find((l) => l.id === district.parentId) : undefined;
    if (!parent || parent.type !== LocationType.DIVISION || !divisionBySlug.has(parent.slug)) {
      throw new Error('Location seed integrity failure: a district has an invalid or missing division parent');
    }
  }

  // A same-named district/division pair must always be two DISTINCT records
  // (separate id). This is the explicit slug-collision regression guard.
  for (const district of districts) {
    const sameSlugDivision = divisionBySlug.get(district.slug);
    if (sameSlugDivision && sameSlugDivision.id === district.id) {
      throw new Error('Location seed integrity failure: a district record collided with its same-named division record');
    }
  }

  const districtIdentity = new Set(districts.map((d) => `${d.type}:${d.parentId}:${d.slug}`));
  if (districtIdentity.size !== districts.length) {
    throw new Error('Location seed integrity failure: duplicate district identity (type, parent, slug)');
  }

  const divisionSlugs = new Set(divisions.map((d) => d.slug));
  if (divisionSlugs.size !== divisions.length) {
    throw new Error('Location seed integrity failure: duplicate division slugs');
  }
}
