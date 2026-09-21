import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider, StorageUploadResult } from './storage.provider';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
    this.endpoint = this.configService.get<string>('S3_ENDPOINT', '');
    this.region = this.configService.get<string>('S3_REGION', 'auto');
    this.bucket = this.configService.get<string>('S3_BUCKET', '');
    this.accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID', '');
    this.secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY', '');
    this.publicBaseUrl = this.configService.get<string>('S3_PUBLIC_BASE_URL', '');
    if (!this.region || !this.bucket || !this.accessKeyId || !this.secretAccessKey || !this.publicBaseUrl) {
      throw new Error('STORAGE_PROVIDER=s3 requires S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_BASE_URL; S3_ENDPOINT is required for R2-compatible endpoints');
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

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
