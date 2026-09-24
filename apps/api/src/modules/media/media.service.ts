import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { imageSize } from 'image-size';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider } from '../../common/storage/storage.provider';
import { UpdateMediaDto } from './dto/update-media.dto';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import { MediaUploadPurpose, getMaxUploadSizeBytes, buildObjectKeyPrefix } from './media-limits';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EXTENSIONS_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — legacy direct-upload endpoint's own limit, unchanged.
const PRESIGN_EXPIRES_SECONDS = 10 * 60; // 10 minutes — spec's suggested 5-15 minute window.

/** The `mimetype` on an uploaded file is whatever Content-Type the client's multipart request claimed
 * — trivially spoofable (rename a script to photo.jpg, send it as image/jpeg). Checking the file's own
 * magic bytes is the actual file-type validation, cheap enough not to need a dependency: these formats'
 * signatures are a handful of fixed leading bytes each. Exported so completeUpload() can run the exact
 * same check on a presigned-uploaded object once it's read back from storage. */
export function hasValidImageSignature(buffer: Buffer | undefined, mimetype: string): boolean {
  if (!buffer || buffer.length < 12) return false;
  switch (mimetype) {
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case 'image/webp':
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    case 'image/gif':
      return buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a';
    default:
      return false;
  }
}

/** Never trusts client-supplied width/height (spec Step 25) — inspects the actual file bytes. Returns
 * undefined rather than throwing on a file image-size can't parse; dimensions are informational (for
 * layout/CLS), not a validation gate, so a parse failure shouldn't block an otherwise-valid upload. */
function detectDimensions(buffer: Buffer): { width?: number; height?: number } {
  try {
    const { width, height } = imageSize(buffer);
    return { width, height };
  } catch {
    return {};
  }
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject('StorageProvider') private readonly storage: StorageProvider,
  ) {}

  private currentProviderKind(): 'LOCAL' | 'R2' {
    const media = this.configService.get<string>('MEDIA_STORAGE_PROVIDER', '');
    if (media) return media === 'r2' ? 'R2' : 'LOCAL';
    return this.configService.get<string>('STORAGE_PROVIDER', 'local') === 's3' ? 'R2' : 'LOCAL';
  }

  // ==================== DIRECT SERVER UPLOAD (existing path — small/local-dev uploads) ====================

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
    const key = `media/${randomUUID()}${ext}`;

    const result = await this.storage.upload(file, key);
    const { width, height } = detectDimensions(file.buffer);

    return this.prisma.media.create({
      data: {
        filename: result.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width, height,
        storageKey: result.key,
        publicUrl: result.url,
        altText: dto.altText,
        caption: dto.caption,
        credit: dto.credit,
        uploadedById: userId,
        status: 'READY',
        provider: this.currentProviderKind(),
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  // ==================== PRESIGNED UPLOAD (browser uploads directly to storage) ====================

  async createPresignedUpload(dto: CreatePresignedUploadDto, userId: string) {
    if (!ALLOWED_MIME_TYPES.includes(dto.contentType)) {
      throw new BadRequestException(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }
    const purpose = dto.purpose ?? MediaUploadPurpose.GENERAL;
    const maxSize = getMaxUploadSizeBytes(this.configService, purpose);
    if (dto.size > maxSize) {
      throw new BadRequestException(`File too large. Maximum size for ${purpose}: ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    const ext = EXTENSIONS_BY_MIME[dto.contentType] || path.extname(dto.filename).toLowerCase();
    const prefix = buildObjectKeyPrefix(purpose, purpose === MediaUploadPurpose.AVATAR ? userId : undefined);
    const key = `${prefix}/${randomUUID()}/original${ext}`;

    const presigned = await this.storage.createPresignedUpload(key, dto.contentType, PRESIGN_EXPIRES_SECONDS);

    const media = await this.prisma.media.create({
      data: {
        filename: path.basename(key),
        originalFilename: dto.filename,
        mimeType: dto.contentType,
        size: dto.size,
        storageKey: key,
        // Not publicly resolvable until READY — completeUpload() is what makes this URL actually
        // point at real bytes. Computed now (not left blank) since getPublicUrl is a pure key->URL
        // derivation with no dependency on the object existing yet.
        publicUrl: this.storage.getPublicUrl(key),
        altText: dto.altText,
        uploadedById: userId,
        status: 'UPLOADING',
        provider: this.currentProviderKind(),
        uploadExpiresAt: new Date(Date.now() + PRESIGN_EXPIRES_SECONDS * 1000),
      },
    });

    return {
      mediaId: media.id,
      uploadUrl: presigned.uploadUrl,
      objectKey: key,
      expiresIn: presigned.expiresIn,
      requiredHeaders: presigned.requiredHeaders,
    };
  }

  /**
   * Never trusts the browser's "the upload succeeded" — verifies the object actually exists in storage,
   * then re-runs the same magic-byte signature check and dimension detection the direct-upload path gets
   * (a presigned upload doesn't get a weaker validation pass just because the bytes bypassed this
   * process). Only the uploader (or someone with media.manage) may complete their own pending upload —
   * completing an arbitrary mediaId would let one user coerce another's UPLOADING row into READY.
   */
  async completeUpload(id: string, userId: string, userPermissions: string[] = []) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    if (media.uploadedById !== userId && !userPermissions.includes('media.manage')) {
      throw new ForbiddenException('You cannot complete another user\'s upload');
    }
    if (media.status !== 'UPLOADING') {
      throw new BadRequestException(`Only an in-progress upload can be completed (current status: ${media.status})`);
    }

    const exists = await this.storage.exists(media.storageKey);
    if (!exists) {
      await this.prisma.media.update({ where: { id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Upload verification failed: the file was not found in storage. Try uploading again.');
    }

    const buffer = await this.storage.readObject(media.storageKey);
    if (!buffer || !hasValidImageSignature(buffer, media.mimeType)) {
      await this.prisma.media.update({ where: { id }, data: { status: 'FAILED' } });
      await this.storage.delete(media.storageKey).catch(() => {});
      throw new BadRequestException('Uploaded file content does not match the declared image type.');
    }

    const { width, height } = detectDimensions(buffer);
    return this.prisma.media.update({
      where: { id },
      data: { status: 'READY', size: buffer.length, width, height, uploadExpiresAt: null },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  }

  // ==================== READ / UPDATE ====================

  async findAll(page = 1, limit = 20, search?: string, mimeType?: string, status?: string, uploadedById?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { originalFilename: { contains: search, mode: 'insensitive' } },
        { altText: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (mimeType) where.mimeType = mimeType;
    if (status) where.status = status;
    if (uploadedById) where.uploadedById = uploadedById;

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

  // ==================== DELETE / REPLACE ====================

  /**
   * Refuses to delete media that is still in active use. The FK columns (Article.featuredImageId,
   * Ad.mediaId, EditorialCollection.coverImageId, ReaderProfile.avatarMediaId, Employer.logoId/coverId,
   * AdCreative.desktopMediaId/mobileMediaId) are all `ON DELETE SET NULL`, so an unchecked delete would
   * not fail loudly — it would silently blank out a live published article's featured image (or an ad's
   * creative, a reader's avatar, an employer's logo) and only then remove the file, leaving no way back.
   * Images embedded inside an article's TipTap body content are plain URLs inside a JSON blob, not a
   * tracked relation, so they can't be checked this way — deleting a body-embedded image will still
   * 404 in that article. That is a known, structural limitation, not something this check can catch.
   */
  private async assertNotReferenced(id: string) {
    const [articleCount, adCount, collectionCount, avatarCount, adCreativeCount, employerLogoCount, employerCoverCount] = await Promise.all([
      this.prisma.article.count({ where: { featuredImageId: id } }),
      this.prisma.ad.count({ where: { mediaId: id } }),
      this.prisma.editorialCollection.count({ where: { coverImageId: id } }),
      this.prisma.readerProfile.count({ where: { avatarMediaId: id } }),
      this.prisma.adCreative.count({ where: { OR: [{ desktopMediaId: id }, { mobileMediaId: id }] } }),
      this.prisma.employer.count({ where: { logoMediaId: id } }),
      this.prisma.employer.count({ where: { coverMediaId: id } }),
    ]);
    const reasons: string[] = [];
    if (articleCount) reasons.push(`${articleCount} article${articleCount === 1 ? '' : 's'}`);
    if (adCount) reasons.push(`${adCount} ad${adCount === 1 ? '' : 's'}`);
    if (collectionCount) reasons.push(`${collectionCount} collection${collectionCount === 1 ? '' : 's'}`);
    if (avatarCount) reasons.push(`${avatarCount} avatar${avatarCount === 1 ? '' : 's'}`);
    if (adCreativeCount) reasons.push(`${adCreativeCount} ad creative${adCreativeCount === 1 ? '' : 's'}`);
    if (employerLogoCount) reasons.push(`${employerLogoCount} employer logo${employerLogoCount === 1 ? '' : 's'}`);
    if (employerCoverCount) reasons.push(`${employerCoverCount} employer cover${employerCoverCount === 1 ? '' : 's'}`);
    if (reasons.length) {
      throw new BadRequestException(`Cannot delete: this media is still used by ${reasons.join(', ')}. Remove it from there first.`);
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

  /**
   * Uploads a new file under a brand-new key and, only once that succeeds, swaps every reference from
   * the old media row to the new one (never edits a key in place — an immutable, UUID-keyed asset is
   * always cache-safe). The old media row/object is left alone if it's now unreferenced, rather than
   * deleted automatically here: that's exactly what the orphan-detection foundation (findOrphanCandidates)
   * is for, so a replace can't accidentally destroy something still in use elsewhere.
   */
  async replace(id: string, file: Express.Multer.File, userId: string, userPermissions: string[] = []) {
    const existing = await this.prisma.media.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    if (existing.uploadedById !== userId && !userPermissions.includes('media.manage')) {
      throw new ForbiddenException('You cannot replace media you did not upload');
    }

    const created = await this.upload(file, userId, { altText: existing.altText ?? undefined, caption: existing.caption ?? undefined, credit: existing.credit ?? undefined });

    await this.prisma.$transaction([
      this.prisma.article.updateMany({ where: { featuredImageId: id }, data: { featuredImageId: created.id } }),
      this.prisma.ad.updateMany({ where: { mediaId: id }, data: { mediaId: created.id } }),
      this.prisma.editorialCollection.updateMany({ where: { coverImageId: id }, data: { coverImageId: created.id } }),
      this.prisma.readerProfile.updateMany({ where: { avatarMediaId: id }, data: { avatarMediaId: created.id } }),
      this.prisma.adCreative.updateMany({ where: { desktopMediaId: id }, data: { desktopMediaId: created.id } }),
      this.prisma.adCreative.updateMany({ where: { mobileMediaId: id }, data: { mobileMediaId: created.id } }),
      this.prisma.employer.updateMany({ where: { logoMediaId: id }, data: { logoMediaId: created.id } }),
      this.prisma.employer.updateMany({ where: { coverMediaId: id }, data: { coverMediaId: created.id } }),
    ]);

    return created;
  }

  // ==================== ORPHAN DETECTION FOUNDATION ====================

  /**
   * Reporting only — never deletes anything (spec Step 24). Two kinds of candidate:
   *  - `stalledUploads`: UPLOADING rows whose presign window expired without a completeUpload() call
   *    (the browser upload never happened, or completeUpload was never called).
   *  - `unreferenced`: READY media not pointed to by any of the FK columns assertNotReferenced() checks,
   *    excluding anything uploaded in the last `graceHours` (a just-uploaded image mid-article-draft
   *    hasn't been saved into a relation yet, so it must not be flagged as orphaned).
   * A future cleanup job decides what, if anything, to do with these lists.
   */
  async findOrphanCandidates(graceHours = 24) {
    const graceCutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);

    const stalledUploads = await this.prisma.media.findMany({
      where: { status: 'UPLOADING', uploadExpiresAt: { lt: new Date() } },
      select: { id: true, originalFilename: true, storageKey: true, createdAt: true, uploadExpiresAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const readyCandidates = await this.prisma.media.findMany({
      where: { status: 'READY', createdAt: { lt: graceCutoff } },
      select: {
        id: true, originalFilename: true, storageKey: true, size: true, createdAt: true,
        featuredArticles: { select: { id: true }, take: 1 },
        ads: { select: { id: true }, take: 1 },
        collectionCovers: { select: { id: true }, take: 1 },
        readerAvatars: { select: { userId: true }, take: 1 },
        adCreativeDesktopFor: { select: { id: true }, take: 1 },
        adCreativeMobileFor: { select: { id: true }, take: 1 },
        employerLogos: { select: { id: true }, take: 1 },
        employerCovers: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const unreferenced = readyCandidates
      .filter((m) =>
        !m.featuredArticles.length && !m.ads.length && !m.collectionCovers.length && !m.readerAvatars.length &&
        !m.adCreativeDesktopFor.length && !m.adCreativeMobileFor.length && !m.employerLogos.length && !m.employerCovers.length)
      .map((m) => ({ id: m.id, originalFilename: m.originalFilename, storageKey: m.storageKey, size: m.size, createdAt: m.createdAt }));

    return {
      stalledUploads,
      unreferenced,
      note: 'Detection/reporting only — nothing here has been deleted. An image embedded inside article body content (not a featured image) cannot be detected this way; see MediaService.assertNotReferenced.',
    };
  }
}
