import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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

  // Real magic bytes, not just a claimed mimetype — hasValidImageSignature() checks the file's own
  // leading bytes, so every upload test needs a buffer that actually looks like the format it claims.
  const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const WEBP_SIGNATURE = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

  const mockFile = {
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: JPEG_SIGNATURE,
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
    exists: jest.fn().mockResolvedValue(true),
    readObject: jest.fn().mockResolvedValue(JPEG_SIGNATURE),
    createPresignedUpload: jest.fn().mockResolvedValue({
      uploadUrl: 'http://test.com/presigned',
      key: 'media/presigned-key.jpg',
      expiresIn: 600,
      requiredHeaders: { 'Content-Type': 'image/jpeg' },
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks(); // mockStorage's jest.fn()s are module-scoped, so call counts must be cleared per test.
    prisma = {
      media: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      // Referenced-media protection (remove()) checks these relations before deleting.
      article: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      ad: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      editorialCollection: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      readerProfile: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      adCreative: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      employer: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (_key: string, fallback?: unknown) => fallback } },
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

    it('generates a distinct storage key per upload, even for two files sharing the same original filename (collision avoidance)', async () => {
      prisma.media.create.mockResolvedValue(mockMedia);

      await service.upload(mockFile, 'u1', {});
      await service.upload(mockFile, 'u1', {});

      const keys = (storage.upload as jest.Mock).mock.calls.map(([, key]) => key);
      expect(keys[0]).not.toBe(keys[1]);
      // Server-generated UUID, never the raw original filename — the actual collision-avoidance mechanism.
      expect(keys[0]).toMatch(/^media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/);
    });

    it('rejects a file whose bytes do not match its claimed MIME type (spoofed Content-Type)', async () => {
      // Renamed/relabeled non-image (e.g. a script) claiming to be a JPEG via Content-Type alone.
      const spoofed = { ...mockFile, mimetype: 'image/jpeg', buffer: Buffer.from('<script>alert(1)</script>') };

      await expect(service.upload(spoofed, 'u1', {})).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('accepts a real PNG signature claimed as image/png', async () => {
      prisma.media.create.mockResolvedValue(mockMedia);
      const png = { ...mockFile, mimetype: 'image/png', buffer: PNG_SIGNATURE };

      await expect(service.upload(png, 'u1', {})).resolves.toBeDefined();
    });

    it('accepts a real WEBP signature claimed as image/webp', async () => {
      prisma.media.create.mockResolvedValue(mockMedia);
      const webp = { ...mockFile, mimetype: 'image/webp', buffer: WEBP_SIGNATURE };

      await expect(service.upload(webp, 'u1', {})).resolves.toBeDefined();
    });

    it('rejects a PNG-signed file claiming to be a JPEG (mismatched signature/mimetype pair)', async () => {
      const mismatched = { ...mockFile, mimetype: 'image/jpeg', buffer: PNG_SIGNATURE };

      await expect(service.upload(mismatched, 'u1', {})).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty or truncated buffer', async () => {
      const empty = { ...mockFile, buffer: Buffer.alloc(0) };

      await expect(service.upload(empty, 'u1', {})).rejects.toThrow(BadRequestException);
    });

    it('derives the extension from the validated MIME type, not the (unsanitized) original filename', async () => {
      prisma.media.create.mockResolvedValue(mockMedia);
      const trickyName = { ...mockFile, originalname: '../../evil.jpg' };

      await service.upload(trickyName, 'u1', {});

      const [, key] = (storage.upload as jest.Mock).mock.calls[0];
      expect(key).not.toContain('..');
      expect(key.startsWith('media/')).toBe(true);
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

    it('searches by original filename or alt text', async () => {
      prisma.media.findMany.mockResolvedValue([]);
      prisma.media.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'sunset');

      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { originalFilename: { contains: 'sunset', mode: 'insensitive' } },
              { altText: { contains: 'sunset', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('filters by mimeType', async () => {
      prisma.media.findMany.mockResolvedValue([]);
      prisma.media.count.mockResolvedValue(0);

      await service.findAll(1, 20, undefined, 'image/png');

      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ mimeType: 'image/png' }) }),
      );
    });

    it('paginates at the database level (skip/take), never loading everything', async () => {
      prisma.media.findMany.mockResolvedValue([]);
      prisma.media.count.mockResolvedValue(0);

      await service.findAll(3, 10);

      expect(prisma.media.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
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

    it('refuses to delete media still used as an article featured image', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.article.count.mockResolvedValue(1);

      await expect(service.remove('1')).rejects.toThrow(BadRequestException);
      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.media.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete media still used as an ad creative', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.ad.count.mockResolvedValue(1);

      await expect(service.remove('1')).rejects.toThrow(BadRequestException);
      expect(prisma.media.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete media still used as a collection cover', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.editorialCollection.count.mockResolvedValue(1);

      await expect(service.remove('1')).rejects.toThrow(BadRequestException);
      expect(prisma.media.delete).not.toHaveBeenCalled();
    });

    it('names what is referencing it in the error message', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.article.count.mockResolvedValue(2);

      await expect(service.remove('1')).rejects.toThrow(/2 articles/);
    });

    it('allows deleting media that nothing references', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.media.delete.mockResolvedValue(mockMedia);
      // article/ad/editorialCollection counts already default to 0 in beforeEach.

      const result = await service.remove('1');

      expect(result.message).toBe('Media deleted successfully');
      expect(storage.delete).toHaveBeenCalledWith('media/test.jpg');
    });
  });

  describe('createPresignedUpload', () => {
    const dto = { filename: 'photo.jpg', contentType: 'image/jpeg', size: 1024 * 1024 };

    it('rejects a disallowed content type', async () => {
      await expect(service.createPresignedUpload({ ...dto, contentType: 'application/pdf' } as any, 'u1')).rejects.toThrow(BadRequestException);
      expect(storage.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('rejects a size over the purpose\'s limit', async () => {
      await expect(service.createPresignedUpload({ ...dto, purpose: 'avatar', size: 6 * 1024 * 1024 } as any, 'u1')).rejects.toThrow(BadRequestException);
    });

    it('creates an UPLOADING media row and returns the presigned URL', async () => {
      prisma.media.create.mockResolvedValue({ id: 'm1' });

      const result = await service.createPresignedUpload(dto as any, 'u1');

      expect(prisma.media.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'UPLOADING', uploadedById: 'u1' }),
      }));
      expect(result).toMatchObject({ mediaId: 'm1', uploadUrl: 'http://test.com/presigned', expiresIn: 600 });
    });

    it('namespaces the object key by purpose', async () => {
      prisma.media.create.mockResolvedValue({ id: 'm1' });
      await service.createPresignedUpload({ ...dto, purpose: 'ad' } as any, 'u1');
      const [key] = (storage.createPresignedUpload as jest.Mock).mock.calls[0];
      expect(key).toMatch(/^ads\//);
    });

    it('scopes an avatar key to the uploading user, not a client-supplied user id', async () => {
      prisma.media.create.mockResolvedValue({ id: 'm1' });
      await service.createPresignedUpload({ ...dto, purpose: 'avatar' } as any, 'the-real-uploader');
      const [key] = (storage.createPresignedUpload as jest.Mock).mock.calls[0];
      expect(key).toMatch(/^avatars\/the-real-uploader\//);
    });
  });

  describe('completeUpload', () => {
    const uploadingMedia = { id: 'm1', status: 'UPLOADING', uploadedById: 'u1', storageKey: 'articles/x/original.jpg', mimeType: 'image/jpeg' };

    it('rejects completing another user\'s upload without media.manage', async () => {
      prisma.media.findUnique.mockResolvedValue(uploadingMedia);
      await expect(service.completeUpload('m1', 'someone-else', [])).rejects.toThrow(/cannot complete/);
    });

    it('allows completing another user\'s upload with media.manage', async () => {
      prisma.media.findUnique.mockResolvedValue(uploadingMedia);
      prisma.media.update.mockResolvedValue({ ...uploadingMedia, status: 'READY' });
      await expect(service.completeUpload('m1', 'admin', ['media.manage'])).resolves.toBeDefined();
    });

    it('rejects completing a media row that is not UPLOADING', async () => {
      prisma.media.findUnique.mockResolvedValue({ ...uploadingMedia, status: 'READY' });
      await expect(service.completeUpload('m1', 'u1', [])).rejects.toThrow(BadRequestException);
    });

    it('marks FAILED and rejects when the object does not actually exist in storage (never trusts the client)', async () => {
      prisma.media.findUnique.mockResolvedValue(uploadingMedia);
      (storage.exists as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.completeUpload('m1', 'u1', [])).rejects.toThrow(BadRequestException);
      expect(prisma.media.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'FAILED' } });
    });

    it('marks FAILED and deletes the object when the uploaded bytes do not match the declared MIME type', async () => {
      prisma.media.findUnique.mockResolvedValue(uploadingMedia);
      (storage.readObject as jest.Mock).mockResolvedValueOnce(PNG_SIGNATURE);

      await expect(service.completeUpload('m1', 'u1', [])).rejects.toThrow(BadRequestException);
      expect(storage.delete).toHaveBeenCalledWith('articles/x/original.jpg');
    });

    it('transitions to READY and clears uploadExpiresAt on a genuinely-verified upload', async () => {
      prisma.media.findUnique.mockResolvedValue(uploadingMedia);
      prisma.media.update.mockResolvedValue({ ...uploadingMedia, status: 'READY' });

      await service.completeUpload('m1', 'u1', []);

      expect(prisma.media.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'READY', uploadExpiresAt: null }),
      }));
    });
  });

  describe('replace', () => {
    it('rejects replacing media uploaded by someone else without media.manage', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      await expect(service.replace('1', mockFile, 'someone-else', [])).rejects.toThrow(/did not upload/);
    });

    it('uploads a new file and repoints every reference from the old id to the new one', async () => {
      prisma.media.findUnique.mockResolvedValue(mockMedia);
      prisma.media.create.mockResolvedValue({ ...mockMedia, id: 'new-id' });

      const result = await service.replace('1', mockFile, 'u1', []);

      expect(result.id).toBe('new-id');
      expect(prisma.article.updateMany).toHaveBeenCalledWith({ where: { featuredImageId: '1' }, data: { featuredImageId: 'new-id' } });
      expect(prisma.readerProfile.updateMany).toHaveBeenCalledWith({ where: { avatarMediaId: '1' }, data: { avatarMediaId: 'new-id' } });
    });
  });

  describe('findOrphanCandidates', () => {
    it('reports stalled (expired, never-completed) presigned uploads', async () => {
      prisma.media.findMany
        .mockResolvedValueOnce([{ id: 'stalled-1', originalFilename: 'x.jpg' }])
        .mockResolvedValueOnce([]);

      const result = await service.findOrphanCandidates();
      expect(result.stalledUploads).toEqual([{ id: 'stalled-1', originalFilename: 'x.jpg' }]);
    });

    it('reports READY media referenced by nothing as unreferenced, excluding anything referenced', async () => {
      prisma.media.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'orphan-1', originalFilename: 'a.jpg', storageKey: 'k1', size: 1, createdAt: new Date(), featuredArticles: [], ads: [], collectionCovers: [], readerAvatars: [], adCreativeDesktopFor: [], adCreativeMobileFor: [], employerLogos: [], employerCovers: [] },
          { id: 'in-use-1', originalFilename: 'b.jpg', storageKey: 'k2', size: 1, createdAt: new Date(), featuredArticles: [{ id: 'art-1' }], ads: [], collectionCovers: [], readerAvatars: [], adCreativeDesktopFor: [], adCreativeMobileFor: [], employerLogos: [], employerCovers: [] },
        ]);

      const result = await service.findOrphanCandidates();

      expect(result.unreferenced.map((m: any) => m.id)).toEqual(['orphan-1']);
    });

    it('never deletes anything — detection only', async () => {
      prisma.media.findMany.mockResolvedValue([]);
      await service.findOrphanCandidates();
      expect(prisma.media.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
