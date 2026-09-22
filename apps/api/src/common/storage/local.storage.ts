import { Injectable, BadRequestException } from '@nestjs/common';
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

  /**
   * The key is always server-generated (MediaService never derives it from user input), so this never
   * actually rejects a real request — it's a defense-in-depth invariant check at the storage layer
   * itself, so a future caller can't accidentally write/read outside the upload directory.
   */
  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.uploadPath, key);
    const root = path.resolve(this.uploadPath);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new BadRequestException('Invalid storage key');
    }
    return resolved;
  }

  async upload(file: Express.Multer.File, key: string): Promise<StorageUploadResult> {
    const filePath = this.resolveSafePath(key);
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
    const filePath = this.resolveSafePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
