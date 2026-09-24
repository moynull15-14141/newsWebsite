import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { MediaController } from './media.controller';
import { MediaLocalUploadController } from './media-local-upload.controller';
import { MediaService } from './media.service';

@Module({
  imports: [StorageModule],
  controllers: [MediaController, MediaLocalUploadController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
