export interface StorageUploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
  filename: string;
  width?: number;
  height?: number;
}

export interface PresignedUploadResult {
  /** Where the browser PUTs the file body directly — never proxied through the NestJS process. */
  uploadUrl: string;
  key: string;
  expiresIn: number;
  /** Extra headers the browser's PUT must send (e.g. Content-Type) for the signature to validate. */
  requiredHeaders?: Record<string, string>;
}

export interface StorageProvider {
  upload(file: Express.Multer.File, key: string): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
  /** True only if the object actually exists in the backing store right now — never inferred from a
   * DB row or from the client's say-so (see MediaService.completeUpload, which calls this). */
  exists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
  /** A short-lived URL the browser can PUT the file body to directly. Must expire — see each
   * implementation for its own expiry mechanism (S3: signature `expiresIn`; local: a signed token). */
  createPresignedUpload(key: string, contentType: string, expiresInSeconds: number): Promise<PresignedUploadResult>;
  /** Reads the object back for post-presigned-upload verification (MediaService.completeUpload uses this
   * to run the same magic-byte signature check and dimension detection the direct-upload path already
   * gets — a presigned upload never skips that just because the bytes didn't pass through this process).
   * Null if the object doesn't exist. Not used for normal public serving (that always goes straight to
   * getPublicUrl()), so this only ever runs once per upload, not on every page view. */
  readObject(key: string): Promise<Buffer | null>;
}
