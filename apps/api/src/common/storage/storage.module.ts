import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage.provider';
import { LocalStorageProvider } from './local.storage';
import { S3StorageProvider } from './s3.storage';

const storageFactory = {
  provide: 'StorageProvider',
  useFactory: (configService: ConfigService): StorageProvider => {
    const provider = configService.get<string>('STORAGE_PROVIDER', 'local');
    if (provider === 's3') {
      return new S3StorageProvider(configService);
    }
    if (provider !== 'local') {
      throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
    }
    if (configService.get<string>('NODE_ENV') === 'production') {
      throw new Error('Production storage requires STORAGE_PROVIDER=s3; local storage is development-only');
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
