import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage.provider';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';

/** Normalizes the two accepted env-var spellings — `MEDIA_STORAGE_PROVIDER` (Phase 2R's convention:
 * local/r2) and the pre-existing `STORAGE_PROVIDER` (local/s3) — to one of 'local' | 'remote', so exactly
 * one factory branch below has to know both names exist. */
function resolveProviderKind(configService: ConfigService): 'local' | 'remote' {
  const mediaProvider = configService.get<string>('MEDIA_STORAGE_PROVIDER', '');
  if (mediaProvider) {
    if (mediaProvider === 'r2' || mediaProvider === 'local') return mediaProvider === 'r2' ? 'remote' : 'local';
    throw new Error(`Unsupported MEDIA_STORAGE_PROVIDER: ${mediaProvider} (expected 'local' or 'r2')`);
  }
  const legacy = configService.get<string>('STORAGE_PROVIDER', 'local');
  if (legacy === 's3' || legacy === 'local') return legacy === 's3' ? 'remote' : 'local';
  throw new Error(`Unsupported STORAGE_PROVIDER: ${legacy} (expected 'local' or 's3')`);
}

const storageFactory = {
  provide: 'StorageProvider',
  useFactory: (configService: ConfigService): StorageProvider => {
    const kind = resolveProviderKind(configService);
    if (kind === 'remote') {
      return new S3StorageProvider(configService);
    }
    if (configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('Production storage requires MEDIA_STORAGE_PROVIDER=r2 (or STORAGE_PROVIDER=s3); local storage is development-only');
    }
    return new LocalStorageProvider(configService);
  },
  inject: [ConfigService],
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [storageFactory],
  exports: ['StorageProvider'],
})
export class StorageModule {}
