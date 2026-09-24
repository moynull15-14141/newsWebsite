import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageProvider, StorageUploadResult, PresignedUploadResult } from './storage.provider';

/** Payload embedded (HMAC-signed) in a local presigned-upload token — see createPresignedUpload/
 * verifyPresignToken. Mirrors what an S3 presigned URL's signature already covers (which key, which
 * content-type, when it expires), just done by hand since there's no real S3-compatible endpoint in dev. */
interface LocalPresignPayload {
  key: string;
  contentType: string;
  exp: number;
}

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private uploadPath: string;
  private publicBaseUrl: string;
  private readonly signingSecret: string;

  constructor(private configService: ConfigService) {
    this.uploadPath = this.configService.get<string>('LOCAL_STORAGE_PATH', './uploads');
    this.publicBaseUrl = this.configService.get<string>('S3_PUBLIC_BASE_URL', 'http://localhost:3001/api/v1/media/files');
    // Reused, not a new secret to manage: JWT_SECRET is already a required, real secret in every
    // environment this provider runs in (local dev only — production requires STORAGE_PROVIDER=s3/r2).
    this.signingSecret = this.configService.get<string>('JWT_SECRET', '');
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

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolveSafePath(key));
  }

  async readObject(key: string): Promise<Buffer | null> {
    const filePath = this.resolveSafePath(key);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private sign(payload: LocalPresignPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  /** Verifies the token's signature and expiry, returning the payload it commits to. Called by
   * MediaLocalUploadController — the one place a raw PUT body is actually written to disk. */
  verifyPresignToken(token: string): LocalPresignPayload {
    const [body, sig] = token.split('.');
    if (!body || !sig) throw new BadRequestException('Invalid upload token');
    const expectedSig = crypto.createHmac('sha256', this.signingSecret).update(body).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      throw new BadRequestException('Invalid upload token signature');
    }
    const payload: LocalPresignPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) throw new BadRequestException('Upload token expired');
    return payload;
  }

  /** Writes a raw PUT body straight to disk at the token's committed key — the local-dev equivalent of
   * a browser PUTting to a real presigned S3 URL. Used only by MediaLocalUploadController. */
  writeRaw(key: string, body: Buffer): void {
    const filePath = this.resolveSafePath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, body);
  }

  /**
   * Local dev has no real S3-compatible PUT endpoint, so this points the browser at this same NestJS
   * process's own `/media/local-upload` route instead — a genuine HTTP PUT that writes straight to disk,
   * not a mocked response. The HMAC-signed token is what makes it a real presigned URL rather than an
   * open write endpoint: only a request carrying a valid, unexpired, key-and-content-type-matching token
   * can write anything.
   */
  async createPresignedUpload(key: string, contentType: string, expiresInSeconds: number): Promise<PresignedUploadResult> {
    const apiUrl = this.configService.get<string>('API_URL', 'http://localhost:3001');
    const exp = Date.now() + expiresInSeconds * 1000;
    const token = this.sign({ key, contentType, exp });
    return {
      uploadUrl: `${apiUrl}/api/v1/media/local-upload?token=${encodeURIComponent(token)}`,
      key,
      expiresIn: expiresInSeconds,
      requiredHeaders: { 'Content-Type': contentType },
    };
  }
}
