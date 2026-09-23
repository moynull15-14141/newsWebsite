import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import { StorageProvider } from '../../common/storage/storage.provider';
import { UpdateMediaDto } from './dto/update-media.dto';
import * as path from 'path';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONS_BY_MIME: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** The `mimetype` on an uploaded file is whatever Content-Type the client's multipart request claimed
 * — trivially spoofable (rename a script to photo.jpg, send it as image/jpeg). Checking the file's own
 * magic bytes is the actual file-type validation Phase 2M asks for, cheap enough not to need a
 * dependency: these three formats' signatures are a handful of fixed leading bytes each. */
function hasValidImageSignature(buffer: Buffer | undefined, mimetype: string): boolean {
  if (!buffer || buffer.length < 12) return false;
  switch (mimetype) {
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case 'image/webp':
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    default:
      return false;
  }
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('StorageProvider') private readonly storage: StorageProvider,
  ) {}

  async upload(file: Express.Multer.File, userId: string, dto: { altText?: string; caption?: string; credit?: string }) {
    if (!file) {
      throw new BadRequestException('An image file is required');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    if (!hasValidImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('File content does not match a supported image format.');
    }

    // Extension is derived from the validated MIME type, never from the client-supplied filename —
    // keeps storage keys predictable and immune to path traversal or double-extension tricks
    // (e.g. "photo.jpg.exe" or "../../etc/passwd.png") regardless of what originalFilename claims.
    const ext = EXTENSIONS_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const key = `media/${timestamp}-${random}${ext}`;

    const result = await this.storage.upload(file, key);

    return this.prisma.media.create({
      data: {
        filename: result.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: result.key,
        publicUrl: result.url,
        altText: dto.altText,
        caption: dto.caption,
        credit: dto.credit,
        uploadedById: userId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(page = 1, limit = 20, search?: string, mimeType?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { originalFilename: { contains: search, mode: 'insensitive' } },
        { altText: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (mimeType) {
      where.mimeType = mimeType;
    }

    const [media, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data: media,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media;
  }

  async update(id: string, dto: UpdateMediaDto, userId: string) {
    const existing = await this.prisma.media.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Media not found');
    }

    return this.prisma.media.update({
      where: { id },
      data: {
        altText: dto.altText,
        caption: dto.caption,
        credit: dto.credit,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Refuses to delete media that is still in active use. The FK columns (Article.featuredImageId,
   * Ad.mediaId, EditorialCollection.coverImageId) are all `ON DELETE SET NULL`, so an unchecked delete
   * would not fail loudly — it would silently blank out a live published article's featured image (or
   * an ad's creative, or a collection's cover) and only then remove the file, leaving no way back.
   * Images embedded inside an article's TipTap body content are plain URLs inside a JSON blob, not a
   * tracked relation, so they can't be checked this way — deleting a body-embedded image will still
   * 404 in that article. That is a known, structural limitation, not something this check can catch.
   */
  private async assertNotReferenced(id: string) {
    const [articleCount, adCount, collectionCount] = await Promise.all([
      this.prisma.article.count({ where: { featuredImageId: id } }),
      this.prisma.ad.count({ where: { mediaId: id } }),
      this.prisma.editorialCollection.count({ where: { coverImageId: id } }),
    ]);
    const reasons: string[] = [];
    if (articleCount) reasons.push(`${articleCount} article${articleCount === 1 ? '' : 's'}`);
    if (adCount) reasons.push(`${adCount} ad${adCount === 1 ? '' : 's'}`);
    if (collectionCount) reasons.push(`${collectionCount} collection${collectionCount === 1 ? '' : 's'}`);
    if (reasons.length) {
      throw new BadRequestException(`Cannot delete: this media is still used as the featured image/cover for ${reasons.join(', ')}. Remove it from there first.`);
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.media.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Media not found');
    }

    await this.assertNotReferenced(id);

    await this.storage.delete(existing.storageKey);
    await this.prisma.media.delete({ where: { id } });

    return { message: 'Media deleted successfully' };
  }
}
