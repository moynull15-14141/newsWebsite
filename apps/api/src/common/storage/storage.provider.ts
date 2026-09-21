export interface StorageUploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
  filename: string;
  width?: number;
  height?: number;
}

export interface StorageProvider {
  upload(file: Express.Multer.File, key: string): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
