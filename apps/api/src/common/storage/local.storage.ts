import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider, StorageUploadResult } from './storage.provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private uploadPath: string;
  private publicBaseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadPath = this.configService.get<string>('LOCAL_STORAGE_PATH', './uploads');
    this.publicBaseUrl = this.configService.get<string>('S3_PUBLIC_BASE_URL', 'http://localhost:3001/api/v1/media/files');
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async upload(file: Express.Multer.File, key: string): Promise<StorageUploadResult> {
    const filePath = path.join(this.uploadPath, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, file.buffer);
    return {
      key,
      url: `${this.publicBaseUrl}/${key}`,
      size: file.size,
      mimeType: file.mimetype,
      filename: file.originalname,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadPath, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
