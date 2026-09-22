import {
  BANGLADESH_DIVISIONS,
  BANGLADESH_DISTRICTS,
  EXPECTED_DIVISION_COUNT,
  EXPECTED_DISTRICT_COUNT,
  verifyLocationSeedIntegrity,
  SeedLocationRow,
} from '../../common/location/bangladesh-locations';

// LocationType enum values as stored in the DB (schema enum).
const COUNTRY = 'COUNTRY';
const DIVISION = 'DIVISION';
const DISTRICT = 'DISTRICT';

/** Builds an in-memory location tree shaped like the seed output. */
function buildTree(): SeedLocationRow[] {
  const country: SeedLocationRow = { id: 'country-1', name: 'Bangladesh', slug: 'bangladesh', type: COUNTRY as never, parentId: null };
  const divisions: SeedLocationRow[] = BANGLADESH_DIVISIONS.map((d, i) => ({
    id: `div-${i}`,
    name: d.name,
    slug: d.slug,
    type: DIVISION as never,
    parentId: country.id,
  }));
  const divisionIdBySlug = new Map(divisions.map((d) => [d.slug, d.id]));
  const districts: SeedLocationRow[] = BANGLADESH_DISTRICTS.map((d, i) => ({
    id: `dist-${i}`,
    name: d.name,
    slug: d.slug,
    type: DISTRICT as never,
    parentId: divisionIdBySlug.get(d.division)!,
  }));
  return [country, ...divisions, ...districts];
}

/** Simulates the OLD broken slug-only upsert: a district with a slug equal to
 * an existing division would resolve to (and overwrite) the division row. */
function slugOnlyUpsert(rows: SeedLocationRow[], district: { slug: string; division: string }): void {
  const existing = rows.find((r) => r.slug === district.slug);
  if (existing) {
    existing.type = DISTRICT as never; // old bug: mutates the division
    return;
  }
  rows.push({ id: `new-${district.slug}`, name: district.slug, slug: district.slug, type: DISTRICT as never, parentId: null });
}

describe('P0-02 Bangladesh location seed integrity', () => {
  it('defines exactly 8 divisions and 64 districts', () => {
    expect(BANGLADESH_DIVISIONS).toHaveLength(EXPECTED_DIVISION_COUNT);
    expect(BANGLADESH_DISTRICTS).toHaveLength(EXPECTED_DISTRICT_COUNT);
    expect(EXPECTED_DIVISION_COUNT).toBe(8);
    expect(EXPECTED_DISTRICT_COUNT).toBe(64);
  });

  it('builds a tree with 1 country, 8 divisions, 64 districts and valid parents', () => {
    const rows = buildTree();
    expect(() => verifyLocationSeedIntegrity(rows)).not.toThrow();
    expect(rows.filter((r) => r.type === COUNTRY)).toHaveLength(1);
    expect(rows.filter((r) => r.type === DIVISION)).toHaveLength(8);
    expect(rows.filter((r) => r.type === DISTRICT)).toHaveLength(64);
  });

  it('Phase 2C: does not reject other (global) COUNTRY records existing alongside Bangladesh', () => {
    const rows = buildTree();
    rows.push(
      { id: 'continent-asia', name: 'Asia', slug: 'asia', type: 'CONTINENT' as never, parentId: null },
      { id: 'country-india', name: 'India', slug: 'india', type: COUNTRY as never, parentId: 'continent-asia' },
      { id: 'country-china', name: 'China', slug: 'china', type: COUNTRY as never, parentId: 'continent-asia' },
    );
    expect(() => verifyLocationSeedIntegrity(rows)).not.toThrow();
    expect(rows.filter((r) => r.type === COUNTRY)).toHaveLength(3); // Bangladesh + 2 global countries
  });

  it('still rejects a tree with zero or duplicate Bangladesh country records', () => {
    const noBangladesh = buildTree().filter((r) => r.slug !== 'bangladesh');
    expect(() => verifyLocationSeedIntegrity(noBangladesh)).toThrow(/exactly one Bangladesh/);

    const duplicateBangladesh = buildTree();
    duplicateBangladesh.push({ id: 'country-2', name: 'Bangladesh (dup)', slug: 'bangladesh', type: COUNTRY as never, parentId: null });
    expect(() => verifyLocationSeedIntegrity(duplicateBangladesh)).toThrow(/exactly one Bangladesh/);
  });

  it('keeps Dhaka Division and Dhaka District as separate records with correct parentage', () => {
    const rows = buildTree();
    const dhakaDivision = rows.find((r) => r.slug === 'dhaka' && r.type === DIVISION)!;
    const dhakaDistrict = rows.find((r) => r.slug === 'dhaka' && r.type === DISTRICT)!;
    expect(dhakaDivision).toBeDefined();
    expect(dhakaDistrict).toBeDefined();
    expect(dhakaDivision.id).not.toBe(dhakaDistrict.id);
    expect(dhakaDistrict.type).toBe(DISTRICT);
    expect(dhakaDivision.type).toBe(DIVISION);
    expect(dhakaDistrict.parentId).toBe(dhakaDivision.id);
  });

  it('every district has a valid division parent (no orphans, no wrong parents)', () => {
    const rows = buildTree();
    const divisionIds = new Set(rows.filter((r) => r.type === DIVISION).map((r) => r.id));
    for (const d of rows.filter((r) => r.type === DISTRICT)) {
      expect(d.parentId).toBeTruthy();
      expect(divisionIds.has(d.parentId!)).toBe(true);
    }
  });

  it('same-named district/division pairs are always distinct records', () => {
    const rows = buildTree();
    const shared = ['dhaka', 'barisal', 'chattogram', 'khulna', 'rajshahi', 'rangpur', 'sylhet', 'mymensingh'];
    for (const slug of shared) {
      const division = rows.find((r) => r.slug === slug && r.type === DIVISION)!;
      const district = rows.find((r) => r.slug === slug && r.type === DISTRICT)!;
      expect(division).toBeDefined();
      expect(district).toBeDefined();
      expect(division.id).not.toBe(district.id);
    }
  });

  it('district identities (type, parent, slug) are unique', () => {
    const rows = buildTree();
    const districts = rows.filter((r) => r.type === DISTRICT);
    const identities = new Set(districts.map((d) => `${d.type}:${d.parentId}:${d.slug}`));
    expect(identities.size).toBe(districts.length);
  });

  it('rejects a tree with a missing district', () => {
    const rows = buildTree().filter((r) => !(r.type === DISTRICT && r.slug === 'tangail'));
    expect(() => verifyLocationSeedIntegrity(rows)).toThrow(/64 districts/);
  });

  it('rejects an orphaned district (invalid parent)', () => {
    const rows = buildTree();
    rows.find((r) => r.slug === 'gazipur' && r.type === DISTRICT)!.parentId = 'no-such-division';
    expect(() => verifyLocationSeedIntegrity(rows)).toThrow(/invalid or missing division parent/);
  });

  it('rejects a district that overwrote a same-named division (old slug-only bug)', () => {
    const rows = buildTree();
    // Reproduce the old broken behavior: the district upsert mutates the division row.
    slugOnlyUpsert(rows, { slug: 'dhaka', division: 'dhaka' });
    // The mutated division row now has type DISTRICT, so divisions drop to 7.
    expect(() => verifyLocationSeedIntegrity(rows)).toThrow(/8 divisions/);
  });

  it('rejects duplicate division slugs', () => {
    const rows = buildTree();
    // Keep the count at 8 but make two divisions share a slug.
    rows.find((r) => r.slug === 'barisal' && r.type === DIVISION)!.slug = 'dhaka';
    expect(() => verifyLocationSeedIntegrity(rows)).toThrow(/duplicate division slugs/);
  });

  it('is idempotent: building the tree twice yields identical identity sets', () => {
    const first = buildTree().map((r) => `${r.type}:${r.parentId}:${r.slug}`).sort();
    const second = buildTree().map((r) => `${r.type}:${r.parentId}:${r.slug}`).sort();
    expect(first).toEqual(second);
  });
});
