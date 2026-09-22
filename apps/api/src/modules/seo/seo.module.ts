import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LanguagesModule } from '../languages/languages.module';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [PrismaModule, LanguagesModule],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
