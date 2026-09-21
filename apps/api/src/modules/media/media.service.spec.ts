import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StorageProvider } from '../../common/storage/storage.provider';

describe('MediaService', () => {
  let service: MediaService;
  let prisma: any;
  let storage: any;

  const mockMedia = {
    id: '1',
    filename: 'test.jpg',
    originalFilename: 'test.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    storageKey: 'media/test.jpg',
    publicUrl: 'http://test.com/test.jpg',
    altText: null,
    caption: null,
    credit: null,
    uploadedById: 'u1',
    uploadedBy: { id: 'u1', name: 'User' },
    createdAt: new Date(),
  };

  const mockFile = {
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test'),
  } as Express.Multer.File;

  const mockStorage: StorageProvider = {
    upload: jest.fn().mockResolvedValue({
      key: 'media/test.jpg',
      url: 'http://test.com/test.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      filename: 'test.jpg',
    }),
    delete: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn().mockReturnValue('http://test.com/test.jpg'),
  };

  beforeEach(async () => {
    prisma = {
      media: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'StorageProvider', useValue: mockStorage },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    storage = module.get<StorageProvider>('StorageProvider');
  });

  describe('upload', () => {
    it('validates mime type (rejects non-image)', async () => {
      const textFile = { ...mockFile, mimetype: 'text/plain' };

      await expect(service.upload(textFile, 'u1', {})).rejects.toThrow(BadRequestException);
    });

    it('validates file size', async () => {
      const largeFile = { ...mockFile, size: 20 * 1024 * 1024 };

      await expect(service.upload(largeFile, 'u1', {})).rejects.toThrow(BadRequestException);
    });

    it('creates media record', async () => {
      prisma.media.create.mockResolvedValue(mockMedia);

      const result = await service.upload(mockFile, 'u1', { altText: 'Test alt' });

      expect(storage.upload).toHaveBeenCalled();
      expect(prisma.media.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            altText: 'Test alt',
            uploadedById: 'u1',
          }),
        }),
      );
      expect(result).toEqual(mockMedia);
    });
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      prisma.media.findMany.mockResolvedValue([mockMedia]);
      prisma.media.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toEqual([mockMedia]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns media', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);

      const result = await service.findOne('1');
      expect(result).toEqual(mockMedia);
    });

    it('throws NotFoundException for non-existent', async () => {
      prisma.media.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates metadata', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.media.update.mockResolvedValue({ ...mockMedia, altText: 'Updated' });

      const result = await service.update('1', { altText: 'Updated' }, 'u1');
      expect(result.altText).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('deletes from storage and database', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.media.delete.mockResolvedValue(mockMedia);

      await service.remove('1');

      expect(storage.delete).toHaveBeenCalledWith('media/test.jpg');
      expect(prisma.media.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('throws NotFoundException for non-existent', async () => {
      prisma.media.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
