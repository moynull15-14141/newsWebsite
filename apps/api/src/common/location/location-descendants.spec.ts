import { loadLocationDescendants, loadLocationFamilies } from './location-descendants';

describe('loadLocationDescendants', () => {
  it('includes the root plus every level below it — not just direct children', async () => {
    // COUNTRY(bd) -> DIVISION(dhaka-div) -> DISTRICT(dhaka-dist) -> UPAZILA(mirpur)
    const prisma = {
      location: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'dhaka-div' }]) // children of bd
          .mockResolvedValueOnce([{ id: 'dhaka-dist' }]) // children of dhaka-div
          .mockResolvedValueOnce([{ id: 'mirpur' }]) // children of dhaka-dist
          .mockResolvedValueOnce([]), // children of mirpur: none
      },
    };

    const ids = await loadLocationDescendants(prisma as any, ['bd']);

    expect(ids).toEqual(expect.arrayContaining(['bd', 'dhaka-div', 'dhaka-dist', 'mirpur']));
    expect(ids).toHaveLength(4);
  });

  it('returns just the root when it has no children', async () => {
    const prisma = { location: { findMany: jest.fn().mockResolvedValue([]) } };
    const ids = await loadLocationDescendants(prisma as any, ['leaf-district']);
    expect(ids).toEqual(['leaf-district']);
  });

  it('stops requesting once a level has no children (bounded by hierarchy depth, not row count)', async () => {
    const prisma = {
      location: {
        findMany: jest.fn().mockResolvedValueOnce([{ id: 'child' }]).mockResolvedValueOnce([]),
      },
    };
    await loadLocationDescendants(prisma as any, ['root']);
    expect(prisma.location.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('loadLocationFamilies', () => {
  it('keeps each root\'s subtree separate, attributing grandchildren to the right root', async () => {
    // Two independent divisions, each with their own district.
    const prisma = {
      location: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'dhaka-dist', parentId: 'dhaka-div' },
            { id: 'khulna-dist', parentId: 'khulna-div' },
          ])
          .mockResolvedValueOnce([]),
      },
    };

    const families = await loadLocationFamilies(prisma as any, ['dhaka-div', 'khulna-div']);

    expect(families.get('dhaka-div')).toEqual(['dhaka-div', 'dhaka-dist']);
    expect(families.get('khulna-div')).toEqual(['khulna-div', 'khulna-dist']);
  });

  it('returns a family of just the root for an empty root list guard and for a childless root', async () => {
    const prisma = { location: { findMany: jest.fn().mockResolvedValue([]) } };
    const families = await loadLocationFamilies(prisma as any, ['leaf']);
    expect(families.get('leaf')).toEqual(['leaf']);
  });

  it('returns an empty map for no roots without querying', async () => {
    const prisma = { location: { findMany: jest.fn() } };
    const families = await loadLocationFamilies(prisma as any, []);
    expect(families.size).toBe(0);
    expect(prisma.location.findMany).not.toHaveBeenCalled();
  });
});
