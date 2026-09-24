import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider, StorageUploadResult, PresignedUploadResult } from './storage.provider';
import { DeleteObjectCommand, PutObjectCommand, HeadObjectCommand, GetObjectCommand, S3Client, NotFound } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Immutable, UUID-keyed assets (every key this app generates) never change once uploaded — a "replace"
 * always gets a brand-new key rather than overwriting one. Safe to cache forever at the edge. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * S3-compatible storage — works against Cloudflare R2 (this project's actual target) or real AWS S3,
 * since R2 speaks the S3 API. Reads the `R2_*` names Phase 2R's env convention uses, falling back to the
 * pre-existing `S3_*` names so a deployment already configured with the old names keeps working
 * unchanged — this is the same provider, not a second one, just accepting either naming.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private endpoint: string;
  private region: string;
  private bucket: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private publicBaseUrl: string;
  private readonly client: S3Client;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '');
    // R2's endpoint is deterministic from the account id when not given explicitly.
    const derivedR2Endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '';

    this.endpoint = this.configService.get<string>('R2_ENDPOINT', '') || derivedR2Endpoint || this.configService.get<string>('S3_ENDPOINT', '');
    this.region = this.configService.get<string>('S3_REGION', 'auto');
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME', '') || this.configService.get<string>('S3_BUCKET', '');
    this.accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID', '') || this.configService.get<string>('S3_ACCESS_KEY_ID', '');
    this.secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY', '') || this.configService.get<string>('S3_SECRET_ACCESS_KEY', '');
    this.publicBaseUrl = this.configService.get<string>('R2_PUBLIC_URL', '') || this.configService.get<string>('S3_PUBLIC_BASE_URL', '');

    if (!this.endpoint || !this.bucket || !this.accessKeyId || !this.secretAccessKey || !this.publicBaseUrl) {
      throw new Error(
        'R2/S3 storage requires R2_ENDPOINT (or R2_ACCOUNT_ID), R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL ' +
        '(or the legacy S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY/S3_PUBLIC_BASE_URL names).',
      );
    }
    this.client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      forcePathStyle: this.endpoint.includes('localhost'),
      credentials: { accessKeyId: this.accessKeyId, secretAccessKey: this.secretAccessKey },
    });
  }

  async upload(file: Express.Multer.File, key: string): Promise<StorageUploadResult> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
    }));
    return {
      key,
      url: this.getPublicUrl(key),
      size: file.size,
      mimeType: file.mimetype,
      filename: file.originalname,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (error instanceof NotFound) return false;
      // A transient/network error is not "doesn't exist" — surface it rather than silently treating an
      // outage as a missing object (which completeUpload would otherwise report as a failed upload).
      throw error;
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async readObject(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  async createPresignedUpload(key: string, contentType: string, expiresInSeconds: number): Promise<PresignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      uploadUrl,
      key,
      expiresIn: expiresInSeconds,
      requiredHeaders: { 'Content-Type': contentType, 'Cache-Control': IMMUTABLE_CACHE_CONTROL },
    };
  }
}
