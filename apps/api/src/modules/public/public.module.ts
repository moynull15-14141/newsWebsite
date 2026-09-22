import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { ServicesModule } from '../articles/services/services.module';
import { LanguagesModule } from '../languages/languages.module';

@Module({
  imports: [ServicesModule, LanguagesModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
