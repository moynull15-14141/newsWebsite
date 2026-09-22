import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Phase 2C: the Bangladesh hierarchy (tested in locations.service.spec.ts) must keep working unchanged
 * while the same Location model also represents a global hierarchy — continents, countries and cities —
 * with per-location localized names.
 */
describe('LocationsService global hierarchy and localized names', () => {
  let service: LocationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      location: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      language: { findMany: jest.fn() },
      locationTranslation: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  describe('global location types', () => {
    it('creates a top-level CONTINENT with no parent required', async () => {
      prisma.location.findUnique.mockResolvedValue(null); // identityKey free
      prisma.location.create.mockResolvedValue({ id: 'loc-asia', type: 'CONTINENT', name: 'Asia' });

      await service.create({ name: 'Asia', slug: 'asia', type: 'CONTINENT' });

      expect(prisma.location.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'CONTINENT', parentId: null }),
      }));
    });

    it('allows a COUNTRY under a CONTINENT and inherits its countryCode when none is given', async () => {
      prisma.location.findUnique
        .mockResolvedValueOnce(null) // identityKey free
        .mockResolvedValueOnce({ id: 'loc-asia', type: 'CONTINENT', countryCode: null }); // parent lookup

      prisma.location.create.mockResolvedValue({ id: 'loc-india' });

      await service.create({ name: 'India', slug: 'india', type: 'COUNTRY', parentId: 'loc-asia', countryCode: 'in' });

      expect(prisma.location.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ countryCode: 'IN' }), // normalized uppercase
      }));
    });

    it('allows a CITY directly under a COUNTRY (no STATE level required)', async () => {
      prisma.location.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'loc-uk', type: 'COUNTRY' });
      prisma.location.create.mockResolvedValue({ id: 'loc-london' });

      await service.create({ name: 'London', slug: 'london', type: 'CITY', parentId: 'loc-uk' });

      expect(prisma.location.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'CITY', parentId: 'loc-uk' }),
      }));
    });

    it('rejects a CITY parented under an incompatible type like UPAZILA', async () => {
      prisma.location.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'loc-x', type: 'UPAZILA' });

      await expect(service.create({ name: 'X', slug: 'x', type: 'CITY', parentId: 'loc-x' })).rejects.toThrow(BadRequestException);
    });

    it('still requires DIVISION -> COUNTRY, unchanged from the original Bangladesh rule', async () => {
      prisma.location.findUnique.mockResolvedValueOnce(null); // identityKey free
      await expect(service.create({ name: 'Dhaka', slug: 'dhaka', type: 'DIVISION' })).rejects.toThrow(BadRequestException);
    });

    it('still requires UPAZILA to have a DISTRICT parent, unchanged from the original Bangladesh rule', async () => {
      prisma.location.findUnique.mockResolvedValueOnce(null);
      await expect(service.create({ name: 'Savar', slug: 'savar', type: 'UPAZILA' })).rejects.toThrow(BadRequestException);
    });

    it('rejects UPAZILA parented under a DIVISION (skipping the DISTRICT level)', async () => {
      prisma.location.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'loc-dhaka-div', type: 'DIVISION' });
      await expect(service.create({ name: 'Savar', slug: 'savar', type: 'UPAZILA', parentId: 'loc-dhaka-div' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('findGlobalTree', () => {
    it('nests every location under its real parent, regardless of depth or type', async () => {
      prisma.location.findMany.mockResolvedValue([
        { id: 'asia', name: 'Asia', type: 'CONTINENT', parentId: null },
        { id: 'bd', name: 'Bangladesh', type: 'COUNTRY', parentId: null }, // top-level, unchanged
        { id: 'india', name: 'India', type: 'COUNTRY', parentId: 'asia' },
        { id: 'delhi', name: 'Delhi', type: 'STATE', parentId: 'india' },
      ]);

      const tree = await service.findGlobalTree();

      expect(tree.totalCount).toBe(4);
      const roots = tree.roots.map((r: any) => r.name).sort();
      expect(roots).toEqual(['Asia', 'Bangladesh']);
      const asia = tree.roots.find((r: any) => r.name === 'Asia');
      expect(asia.children[0].name).toBe('India');
      expect(asia.children[0].children[0].name).toBe('Delhi');
      const bangladesh = tree.roots.find((r: any) => r.name === 'Bangladesh');
      expect(bangladesh.children).toEqual([]); // no children seeded here, but the field exists
    });
  });

  describe('localized names', () => {
    it('creates a location with its localized name', async () => {
      prisma.location.findUnique.mockResolvedValue(null);
      prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }]);
      prisma.location.create.mockResolvedValue({ id: 'loc-bd' });

      await service.create({ name: 'Bangladesh', slug: 'bangladesh', type: 'COUNTRY', translations: [{ languageId: 'lang-bn', name: 'বাংলাদেশ' }] });

      expect(prisma.location.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ translations: { create: [{ languageId: 'lang-bn', name: 'বাংলাদেশ' }] } }),
      }));
    });

    it('the underlying location stays one entity across languages — only the display name changes', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: 'loc-bd', type: 'COUNTRY', slug: 'bangladesh', parentId: null });
      prisma.language.findMany.mockResolvedValue([{ id: 'lang-bn' }, { id: 'lang-en' }]);
      prisma.location.update.mockResolvedValue({ id: 'loc-bd' });

      await service.update('loc-bd', {
        translations: [{ languageId: 'lang-bn', name: 'বাংলাদেশ' }, { languageId: 'lang-en', name: 'Bangladesh' }],
      });

      expect(prisma.location.update).toHaveBeenCalledTimes(1); // one location row, two localized names
      expect(prisma.locationTranslation.createMany).toHaveBeenCalledWith({
        data: [
          { locationId: 'loc-bd', languageId: 'lang-bn', name: 'বাংলাদেশ' },
          { locationId: 'loc-bd', languageId: 'lang-en', name: 'Bangladesh' },
        ],
      });
    });
  });
});
