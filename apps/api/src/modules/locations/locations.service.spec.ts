import { LocationsService } from './locations.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('LocationsService', () => {
  let prisma: any;
  let service: LocationsService;

  beforeEach(() => {
    prisma = {
      location: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new LocationsService(prisma);
  });

  it('looks up duplicate slugs by hierarchy type', async () => {
    prisma.location.findFirst.mockResolvedValue({
      slug: 'barisal',
      type: 'DISTRICT',
      parent: { type: 'DIVISION' },
      children: [],
    });
    await service.findBySlug('barisal', 'DISTRICT');
    expect(prisma.location.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'barisal', type: 'DISTRICT' } }),
    );
  });

  it('returns a clear not found result for an unknown location', async () => {
    prisma.location.findFirst.mockResolvedValue(null);
    await expect(service.findBySlug('unknown', 'DISTRICT')).rejects.toThrow(NotFoundException);
  });

  it('creates location with composite identityKey', async () => {
    // create() looks up twice: the identityKey must be free, and the parent must exist.
    prisma.location.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.identityKey ? null : { id: where.id, name: 'Dhaka', type: 'DISTRICT' }),
    );
    prisma.location.create.mockResolvedValue({
      id: 'loc-1',
      name: 'Mirpur',
      slug: 'mirpur',
      type: 'UPAZILA',
      identityKey: 'UPAZILA:dist-1:mirpur',
    });

    const result = await service.create({
      name: 'Mirpur',
      slug: 'mirpur',
      type: 'UPAZILA',
      parentId: 'dist-1',
    });

    expect(result.id).toBe('loc-1');
    expect(prisma.location.create).toHaveBeenCalled();
  });

  it('refuses to create a child of a parent that does not exist', async () => {
    prisma.location.findUnique.mockResolvedValue(null); // identityKey free, parent missing
    await expect(service.create({ name: 'Mirpur', slug: 'mirpur', type: 'UPAZILA', parentId: 'missing' } as any)).rejects.toThrow(NotFoundException);
    expect(prisma.location.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException if identityKey already exists', async () => {
    prisma.location.findUnique.mockResolvedValue({ id: 'loc-old' });

    await expect(
      service.create({
        name: 'Mirpur',
        slug: 'mirpur',
        type: 'UPAZILA',
        parentId: 'dist-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents deleting location with associated articles', async () => {
    prisma.location.findUnique.mockResolvedValue({
      id: 'loc-1',
      name: 'Dhaka',
      _count: { articles: 5, children: 0 },
    });

    await expect(service.remove('loc-1')).rejects.toThrow(BadRequestException);
  });

  it('builds hierarchy tree correctly', async () => {
    prisma.location.findMany.mockResolvedValue([
      { id: 'c-1', name: 'Bangladesh', slug: 'bangladesh', type: 'COUNTRY', parentId: null, _count: { articles: 10, children: 8 } },
      { id: 'div-1', name: 'Dhaka', slug: 'dhaka', type: 'DIVISION', parentId: 'c-1', _count: { articles: 6, children: 13 } },
      { id: 'dist-1', name: 'Dhaka', slug: 'dhaka', type: 'DISTRICT', parentId: 'div-1', _count: { articles: 4, children: 0 } },
    ]);

    const tree = await service.findTree();
    expect(tree.country?.name).toBe('Bangladesh');
    expect(tree.divisions.length).toBe(1);
    expect(tree.divisions[0].districts.length).toBe(1);
  });
});
