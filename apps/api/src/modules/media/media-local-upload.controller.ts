import { BadRequestException, Controller, Put, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Inject } from '@nestjs/common';
import { LocalStorageProvider } from '../../common/storage/local.storage';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Local-dev equivalent of a browser PUTting straight to a real presigned S3/R2 URL — see
 * LocalStorageProvider.createPresignedUpload's own comment for why this exists instead of a mock.
 * Public (no JWT) because the token itself IS the authorization, exactly like a real presigned URL: only
 * a request carrying a valid, unexpired, LocalStorageProvider-issued token can write anything, and only
 * to the exact key that token committed to. Registered unconditionally — it's simply never reached when
 * MEDIA_STORAGE_PROVIDER=r2, since createPresignedUpload() then returns a real R2 URL instead.
 */
@Controller('media')
export class MediaLocalUploadController {
  constructor(@Inject('StorageProvider') private readonly storage: LocalStorageProvider) {}

  @Public()
  @Put('local-upload')
  async put(@Query('token') token: string, @Req() req: Request) {
    if (!token) throw new BadRequestException('Missing upload token');
    if (typeof (this.storage as LocalStorageProvider).verifyPresignToken !== 'function') {
      // Storage provider isn't LocalStorageProvider (i.e. MEDIA_STORAGE_PROVIDER=r2) — this route should
      // never be reached in that configuration, but fail loudly rather than silently no-op if it is.
      throw new BadRequestException('Local upload endpoint is not available for the configured storage provider');
    }
    const { key, contentType } = this.storage.verifyPresignToken(token);
    const contentTypeHeader = req.headers['content-type'];
    if (contentTypeHeader && contentTypeHeader !== contentType) {
      throw new BadRequestException('Content-Type does not match the type this upload was authorized for');
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException('Empty upload body');
    }
    this.storage.writeRaw(key, body);
    return { key, size: body.length };
  }
}
