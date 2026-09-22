import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LanguagesService } from './languages.service';
import { PrismaService } from '../../prisma/prisma.service';

const uniqueConstraintError = () => new Prisma.PrismaClientKnownRequestError('unique constraint', { code: 'P2002', clientVersion: 'test' });

describe('LanguagesService', () => {
  let service: LanguagesService;
  let prisma: any;

  const bn = { id: 'lang-bn', code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr', isActive: true, isDefault: true, sortOrder: 0 };
  const en = { id: 'lang-en', code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isActive: true, isDefault: false, sortOrder: 1 };

  beforeEach(async () => {
    prisma = {
      language: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LanguagesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LanguagesService>(LanguagesService);
  });

  describe('findActive', () => {
    it('returns only active languages, ordered by sortOrder', async () => {
      prisma.language.findMany.mockResolvedValue([bn, en]);
      const result = await service.findActive();
      expect(prisma.language.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
      expect(result).toEqual([bn, en]);
    });
  });

  describe('resolveRequested', () => {
    it('resolves an active code to that language', async () => {
      prisma.language.findFirst.mockResolvedValue(en);
      const result = await service.resolveRequested('en');
      expect(prisma.language.findFirst).toHaveBeenCalledWith({ where: { code: 'en', isActive: true } });
      expect(result).toEqual(en);
    });

    it('falls back to the default for an unknown code instead of throwing', async () => {
      prisma.language.findFirst.mockResolvedValue(null);
      prisma.language.findFirst.mockResolvedValueOnce(null);
      const defaultSpy = jest.spyOn(service, 'getDefault').mockResolvedValue(bn as any);
      const result = await service.resolveRequested('fr');
      expect(result).toEqual(bn);
      defaultSpy.mockRestore();
    });

    it('falls back to the default when no code is given', async () => {
      const defaultSpy = jest.spyOn(service, 'getDefault').mockResolvedValue(bn as any);
      const result = await service.resolveRequested();
      expect(prisma.language.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual(bn);
      defaultSpy.mockRestore();
    });

    it('falls back to the default for a disabled language code', async () => {
      // findFirst itself filters isActive:true, so a disabled code resolves to null here.
      prisma.language.findFirst.mockResolvedValue(null);
      const defaultSpy = jest.spyOn(service, 'getDefault').mockResolvedValue(bn as any);
      const result = await service.resolveRequested('fr-disabled');
      expect(result).toEqual(bn);
      defaultSpy.mockRestore();
    });
  });

  describe('getDefault', () => {
    it('returns the language flagged isDefault', async () => {
      prisma.language.findFirst.mockResolvedValue(bn);
      const result = await service.getDefault();
      expect(prisma.language.findFirst).toHaveBeenCalledWith({ where: { isDefault: true } });
      expect(result).toEqual(bn);
    });

    it('throws if no default is configured', async () => {
      prisma.language.findFirst.mockResolvedValue(null);
      await expect(service.getDefault()).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a non-default language without touching the existing default', async () => {
      prisma.language.create.mockResolvedValue(en);
      const result = await service.create({ code: 'en', name: 'English', nativeName: 'English' });
      expect(prisma.language.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual(en);
    });

    it('unsets the previous default when creating a new default language', async () => {
      prisma.language.create.mockResolvedValue({ ...en, isDefault: true });
      await service.create({ code: 'en', name: 'English', nativeName: 'English', isDefault: true });
      expect(prisma.language.updateMany).toHaveBeenCalledWith({ where: { isDefault: true }, data: { isDefault: false } });
    });

    it('rejects a default language that is also inactive', async () => {
      await expect(service.create({ code: 'fr', name: 'French', nativeName: 'Français', isDefault: true, isActive: false })).rejects.toThrow(BadRequestException);
    });

    it('rejects explicitly setting isDefault to false on create', async () => {
      await expect(service.create({ code: 'fr', name: 'French', nativeName: 'Français', isDefault: false })).rejects.toThrow(BadRequestException);
    });

    it('surfaces a duplicate code as a conflict', async () => {
      prisma.language.create.mockRejectedValue(uniqueConstraintError());
      await expect(service.create({ code: 'bn', name: 'Bengali', nativeName: 'বাংলা' })).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('refuses to disable the default language', async () => {
      prisma.language.findUnique.mockResolvedValue(bn);
      await expect(service.update('lang-bn', { isActive: false })).rejects.toThrow(BadRequestException);
    });

    it('refuses to disable the last remaining active language', async () => {
      prisma.language.findUnique.mockResolvedValue(en);
      prisma.language.count.mockResolvedValue(1);
      await expect(service.update('lang-en', { isActive: false })).rejects.toThrow(BadRequestException);
    });

    it('allows disabling a non-default language when another stays active', async () => {
      prisma.language.findUnique.mockResolvedValue(en);
      prisma.language.count.mockResolvedValue(2);
      prisma.language.update.mockResolvedValue({ ...en, isActive: false });
      const result = await service.update('lang-en', { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('moves the default flag atomically when switching languages', async () => {
      prisma.language.findUnique.mockResolvedValue(en);
      prisma.language.update.mockResolvedValue({ ...en, isDefault: true });
      await service.update('lang-en', { isDefault: true });
      expect(prisma.language.updateMany).toHaveBeenCalledWith({ where: { isDefault: true, id: { not: 'lang-en' } }, data: { isDefault: false } });
    });

    it('throws for an unknown language id', async () => {
      prisma.language.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });
});
