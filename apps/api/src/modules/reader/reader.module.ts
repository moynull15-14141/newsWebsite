import { Module } from '@nestjs/common';
import { NewsletterController, ReaderController } from './reader.controller';
import { NewsletterService, NotificationService, ReaderService } from './reader.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [ReaderController, NewsletterController],
  providers: [ReaderService, NotificationService, NewsletterService],
  exports: [ReaderService, NotificationService, NewsletterService],
})
export class ReaderModule {}
